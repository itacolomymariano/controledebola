import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import {
  CreateRefereeInvitationPayload,
  CreateSupplementaryInvitationPayload,
  RefereeInvitation,
  RefereeInvitationStatus,
  SupplementaryHiringOpportunity,
} from '../models/referee-invitation.model';
import { HireableRole, hireableRoleLabel, inviteeRoleLabel } from '../models/event-hiring.model';
import { ScheduleConflict } from '../models/event-registration.model';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../models/profile-role.model';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { parseErrorMessage } from '../utils/parse-error.util';
import { EventService } from './event.service';
import { ParseFileService } from './parse-file.service';
import { PeladaCashService } from './pelada-cash.service';
import { ParseService } from './parse.service';
import { RegistrationService } from './registration.service';

const CLASS = 'RefereeInvitation';
const EVENT_CLASS = 'Event';
const REGISTRATION_CLASS = 'EventRegistration';

@Injectable({ providedIn: 'root' })
export class RefereeInvitationService {
  private readonly changed$ = new Subject<void>();
  readonly onChanged = this.changed$.asObservable();

  constructor(
    private readonly parseService: ParseService,
    private readonly eventService: EventService,
    private readonly registrationService: RegistrationService,
    private readonly cashService: PeladaCashService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async countPendingForCurrentUser(): Promise<number> {
    const user = Parse.User.current();
    if (!user) return 0;

    await this.expirePendingPastDeadline({ invitedUserId: user.id! });

    const query = new Parse.Query(CLASS);
    query.equalTo('invitedUser', user);
    query.equalTo('status', 'pending');
    return query.count();
  }

  async listPendingForCurrentUser(): Promise<RefereeInvitation[]> {
    const user = Parse.User.current();
    if (!user) return [];

    await this.expirePendingPastDeadline({ invitedUserId: user.id! });

    const query = new Parse.Query(CLASS);
    query.equalTo('invitedUser', user);
    query.equalTo('status', 'pending');
    query.include('event');
    query.include('pelada');
    query.include('invitedBy');
    query.include('invitedUser');
    query.descending('createdAt');
    query.limit(100);
    const results = await query.find();
    return results.map((obj) => this.toInvitation(obj));
  }

  async listAwaitingRefereePaymentConfirmation(): Promise<RefereeInvitation[]> {
    const user = Parse.User.current();
    if (!user) return [];

    const byAdmin = new Parse.Query(CLASS);
    byAdmin.equalTo('invitedUser', user);
    byAdmin.equalTo('status', 'accepted');
    byAdmin.equalTo('paymentConfirmedByAdmin', true);
    byAdmin.notEqualTo('paymentConfirmedByReferee', true);

    const legacy = new Parse.Query(CLASS);
    legacy.equalTo('invitedUser', user);
    legacy.equalTo('status', 'accepted');
    legacy.equalTo('paymentReleased', true);
    legacy.notEqualTo('paymentConfirmedByReferee', true);

    const query = Parse.Query.or(byAdmin, legacy);
    query.include('event');
    query.include('pelada');
    query.include('invitedBy');
    query.include('invitedUser');
    query.descending('createdAt');
    query.limit(50);
    const results = await query.find();
    return results.map((obj) => this.toInvitation(obj));
  }

  async listForEvent(eventId: string, role?: ProfileRole): Promise<RefereeInvitation[]> {
    await this.expirePendingPastDeadline({ eventId });

    const query = new Parse.Query(CLASS);
    query.equalTo('event', Parse.Object.extend(EVENT_CLASS).createWithoutData(eventId));
    if (role) {
      query.equalTo('role', role);
    }
    query.include('event');
    query.include('pelada');
    query.include('invitedBy');
    query.include('invitedUser');
    query.ascending('createdAt');
    query.limit(100);
    const results = await query.find();
    return results.map((obj) => this.toInvitation(obj));
  }

  async listAcceptedForSupplementaryHiring(): Promise<SupplementaryHiringOpportunity[]> {
    const user = Parse.User.current();
    if (!user) return [];

    const query = new Parse.Query(CLASS);
    query.equalTo('invitedUser', user);
    query.equalTo('status', 'accepted');
    query.containedIn('role', ['referee', 'scout']);
    query.include('event');
    query.include('registration');
    query.descending('createdAt');
    query.limit(50);
    const invitations = await query.find();

    const opportunities: SupplementaryHiringOpportunity[] = [];
    for (const invitationObj of invitations) {
      const event = invitationObj.get('event') as Parse.Object | undefined;
      if (!event?.id || event.get('isFinished')) continue;

      const role = invitationObj.get('role') as ProfileRole;
      if (role !== 'referee' && role !== 'scout') continue;

      let registration = invitationObj.get('registration') as Parse.Object | undefined;
      if (!registration) {
        const regQuery = new Parse.Query(REGISTRATION_CLASS);
        regQuery.equalTo('event', event);
        regQuery.equalTo('user', user);
        regQuery.equalTo('role', role);
        registration = (await regQuery.first()) ?? undefined;
      }
      if (registration?.get('supplementaryHiringCompleted')) continue;

      opportunities.push({
        invitationId: invitationObj.id!,
        eventId: event.id,
        eventName: (event.get('name') as string) || 'Evento',
        eventStartTime: (event.get('startTime') as Date) ?? new Date(),
        mode: role === 'referee' ? 'flags' : 'assistants',
        role,
      });
    }
    return opportunities;
  }

  async createSupplementary(payload: CreateSupplementaryInvitationPayload): Promise<RefereeInvitation> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para enviar convites.');

    if (payload.offeredAmount < 0) {
      throw new Error('Informe um valor de contratacao valido.');
    }
    if (!payload.responseDeadline || payload.responseDeadline <= new Date()) {
      throw new Error('Informe data e hora limite para a resposta do convite.');
    }

    try {
      const result = await Parse.Cloud.run('createSupplementaryEventInvitation', {
        eventId: payload.eventId,
        invitedUserId: payload.invitedUserId,
        kind: payload.kind,
        offeredAmount: payload.offeredAmount,
        responseDeadline: payload.responseDeadline.toISOString(),
        invitedUserApelido: payload.invitedUserApelido,
        invitedUserFullName: payload.invitedUserFullName,
        invitedUserAvatarUrl: payload.invitedUserAvatarUrl,
      });
      const objectId = result?.objectId ? String(result.objectId) : '';
      if (!objectId) {
        throw new Error('Convite criado sem identificador.');
      }
      const saved = await new Parse.Query(CLASS)
        .include('event')
        .include('pelada')
        .include('invitedBy')
        .include('invitedUser')
        .get(objectId);
      this.notifyChanged();
      return this.toInvitation(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async completeSupplementaryHiring(eventId: string, role: 'referee' | 'scout'): Promise<void> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    try {
      await Parse.Cloud.run('completeSupplementaryHiring', { eventId, role });
      this.notifyChanged();
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async findInviteeScheduleConflict(
    invitedUserId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<ScheduleConflict | null> {
    if (!invitedUserId || !startTime || !endTime) return null;

    try {
      const result = await Parse.Cloud.run('checkInviteeScheduleConflict', {
        invitedUserId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        excludeEventId,
      });

      if (!result?.conflict) return null;

      return {
        eventId: String(result.eventId ?? ''),
        eventName: String(result.eventName ?? 'Outro evento'),
        startTime: this.parseCloudDate(result.startTime) ?? startTime,
        endTime: this.parseCloudDate(result.endTime) ?? endTime,
      };
    } catch {
      // Cloud function indisponivel (ex.: Cloud Code nao publicado): nao bloqueia o envio.
      return null;
    }
  }

  private parseCloudDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object' && 'iso' in (value as Record<string, unknown>)) {
      const parsed = new Date(String((value as { iso: unknown }).iso));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  async create(payload: CreateRefereeInvitationPayload): Promise<RefereeInvitation> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para enviar convites.');

    const role = payload.role ?? 'referee';
    const roleLabel = inviteeRoleLabel(role as HireableRole);

    if (payload.offeredAmount < 0) {
      throw new Error('Informe um valor de contratacao valido.');
    }

    if (!payload.responseDeadline || payload.responseDeadline <= new Date()) {
      throw new Error('Informe data e hora limite para a resposta do convite.');
    }

    const eventQuery = new Parse.Query(EVENT_CLASS);
    eventQuery.include('pelada');
    eventQuery.include('admin');
    const eventObj = await eventQuery.get(payload.eventId);
    const event = await this.eventService.getById(payload.eventId);
    if (!event) throw new Error('Evento nao encontrado.');

    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador do evento pode enviar convites de contratacao.');
    }

    if (!event.peladaId) {
      throw new Error('Evento sem pelada vinculada.');
    }

    const invitedUser = Parse.User.createWithoutData(payload.invitedUserId);

    const duplicateQuery = new Parse.Query(CLASS);
    duplicateQuery.equalTo('event', eventObj);
    duplicateQuery.equalTo('invitedUser', invitedUser);
    duplicateQuery.equalTo('role', role);
    duplicateQuery.containedIn('status', ['pending', 'accepted']);
    const duplicate = await duplicateQuery.first();
    if (duplicate) {
      throw new Error(`Este ${roleLabel} ja possui convite ativo para este evento.`);
    }

    const existingReg = await this.registrationService.getForEventAndUser(
      payload.eventId,
      payload.invitedUserId
    );
    if (existingReg) {
      throw new Error('Este usuario ja esta inscrito neste evento.');
    }

    const invitation = new Parse.Object(CLASS);
    invitation.set('event', eventObj);
    invitation.set('pelada', eventObj.get('pelada'));
    invitation.set('invitedUser', invitedUser);
    invitation.set('invitedBy', user);
    invitation.set('role', role);
    invitation.set('status', 'pending');
    invitation.set('offeredAmount', payload.offeredAmount);
    invitation.set('presenceConfirmed', false);
    invitation.set('paymentConfirmedByAdmin', false);
    invitation.set('paymentConfirmedByReferee', false);
    invitation.set('workCompleted', false);
    invitation.set('paymentReleased', false);
    invitation.set('responseDeadline', payload.responseDeadline);
    invitation.set('excusedFault', false);
    if (payload.attendanceMode) {
      invitation.set('attendanceMode', payload.attendanceMode);
    }

    this.applyInvitedByDisplayFields(invitation, user);

    const apelido = payload.invitedUserApelido?.trim();
    const fullName = payload.invitedUserFullName?.trim();
    const avatarUrl = payload.invitedUserAvatarUrl?.trim();
    if (apelido) invitation.set('invitedUserApelido', apelido);
    if (fullName) invitation.set('invitedUserFullName', fullName);
    if (avatarUrl) invitation.set('invitedUserAvatarUrl', avatarUrl);

    try {
      const saved = await invitation.save();
      await saved.fetchWithInclude(['event', 'pelada', 'invitedBy', 'invitedUser']);
      this.notifyChanged();
      return this.toInvitation(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async accept(invitationId: string): Promise<RefereeInvitation> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para aceitar convites.');

    const query = new Parse.Query(CLASS);
    query.include('event');
    query.include('pelada');
    query.include('invitedBy');
    query.include('invitedUser');
    const invitationObj = await query.get(invitationId);

    const invited = invitationObj.get('invitedUser') as Parse.User | undefined;
    if (invited?.id !== user.id) {
      throw new Error('Este convite nao pertence a voce.');
    }

    const status = invitationObj.get('status') as RefereeInvitationStatus;
    if (status !== 'pending') {
      throw new Error('Este convite ja foi respondido.');
    }

    const deadline = invitationObj.get('responseDeadline') as Date | undefined;
    if (deadline && deadline < new Date()) {
      invitationObj.set('status', 'cancelled');
      await invitationObj.save();
      this.notifyChanged();
      throw new Error('O prazo para responder a este convite expirou.');
    }

    const event = invitationObj.get('event') as Parse.Object;
    const eventId = event.id!;
    const role = (invitationObj.get('role') as ProfileRole | undefined) ?? 'referee';
    const apelido =
      (user.get('apelido') as string) ||
      (user.get('name') as string) ||
      user.getUsername() ||
      PROFILE_ROLE_LABELS[role];

    // Marca aceite antes da inscricao para evitar convite "pending" com inscricao ja criada.
    invitationObj.set('status', 'accepted');
    invitationObj.set('responseAt', new Date());
    this.applyInvitedUserDisplayFields(invitationObj, user);
    try {
      await invitationObj.save();
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }

    let registration;
    try {
      registration = await this.registrationService.registerFromInvitation(eventId, apelido, role, {
        invited: true,
      });
    } catch (error: unknown) {
      const message = parseErrorMessage(error);
      const existing = await this.registrationService.getForEvent(eventId);
      if (existing && existing.role === role) {
        registration = existing;
      } else {
        invitationObj.set('status', 'pending');
        invitationObj.unset('responseAt');
        try {
          await invitationObj.save();
        } catch {
          // Melhor esforço: convite pode ficar accepted sem registration; inbox trata retry.
        }
        throw new Error(message);
      }
    }

    invitationObj.set(
      'registration',
      Parse.Object.extend(REGISTRATION_CLASS).createWithoutData(registration.objectId)
    );

    try {
      const saved = await invitationObj.save();
      await saved.fetchWithInclude(['event', 'pelada', 'invitedBy', 'invitedUser', 'registration']);
      this.notifyChanged();
      return this.toInvitation(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async decline(invitationId: string): Promise<void> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const invitationObj = await new Parse.Query(CLASS).get(invitationId);
    const invited = invitationObj.get('invitedUser') as Parse.User | undefined;
    if (invited?.id !== user.id) {
      throw new Error('Este convite nao pertence a voce.');
    }

    if (invitationObj.get('status') !== 'pending') {
      throw new Error('Este convite ja foi respondido.');
    }

    invitationObj.set('status', 'declined');
    invitationObj.set('responseAt', new Date());
    this.applyInvitedUserDisplayFields(invitationObj, user);
    await invitationObj.save();
    this.notifyChanged();
  }

  async setPresence(
    invitationId: string,
    eventId: string,
    confirmed: boolean,
    arrivalAt?: Date | null
  ): Promise<RefereeInvitation> {
    await this.assertEventAdmin(eventId);
    const invitationObj = await this.getInvitationForEvent(invitationId, eventId);

    if (invitationObj.get('status') !== 'accepted') {
      throw new Error(`Presenca so pode ser confirmada apos o ${inviteeRoleLabel(((invitationObj.get('role') as ProfileRole) ?? 'referee') as HireableRole)} aceitar o convite.`);
    }

    if (confirmed) {
      if (!arrivalAt) {
        throw new Error(`Informe data e hora da chegada do ${inviteeRoleLabel(((invitationObj.get('role') as ProfileRole) ?? 'referee') as HireableRole)}.`);
      }
      invitationObj.set('presenceConfirmed', true);
      invitationObj.set('arrivalAt', arrivalAt);
    } else {
      invitationObj.set('presenceConfirmed', false);
      invitationObj.unset('arrivalAt');
      invitationObj.set('paymentConfirmedByAdmin', false);
      invitationObj.set('workCompleted', false);
    }

    const saved = await invitationObj.save();
    await saved.fetchWithInclude(['event', 'pelada', 'invitedBy', 'invitedUser', 'registration']);
    this.notifyChanged();
    return this.toInvitation(saved);
  }

  async setPaymentConfirmedByAdmin(
    invitationId: string,
    eventId: string,
    confirmed: boolean
  ): Promise<RefereeInvitation> {
    await this.assertEventAdmin(eventId);
    const invitationObj = await this.getInvitationForEvent(invitationId, eventId);

    if (invitationObj.get('status') !== 'accepted') {
      throw new Error('Pagamento so pode ser confirmado apos aceitar o convite.');
    }

    if (confirmed && !invitationObj.get('presenceConfirmed') && !invitationObj.get('excusedFault')) {
      throw new Error('Confirme a presenca ou registre falta justificada antes do pagamento.');
    }

    if (
      confirmed &&
      !invitationObj.get('arrivalAt') &&
      !invitationObj.get('excusedFault')
    ) {
      throw new Error('Informe a data e hora de chegada antes de confirmar o pagamento.');
    }

    if (!confirmed && invitationObj.get('paymentReleased')) {
      throw new Error('Pagamento ja registrado no caixa. Nao e possivel desmarcar.');
    }

    invitationObj.set('paymentConfirmedByAdmin', confirmed);
    invitationObj.set('workCompleted', confirmed);

    const saved = await invitationObj.save();

    if (confirmed && !saved.get('paymentReleased')) {
      await this.releasePayment(saved);
    }

    await saved.fetchWithInclude(['event', 'pelada', 'invitedBy', 'invitedUser', 'registration']);
    this.notifyChanged();
    return this.toInvitation(saved);
  }

  async setExcusedFault(
    invitationId: string,
    eventId: string,
    excused: boolean
  ): Promise<RefereeInvitation> {
    await this.assertEventAdmin(eventId);
    const invitationObj = await this.getInvitationForEvent(invitationId, eventId);

    if (invitationObj.get('status') !== 'accepted') {
      throw new Error('Falta justificada so pode ser registrada apos aceitar o convite.');
    }

    invitationObj.set('excusedFault', excused);
    if (excused) {
      invitationObj.set('presenceConfirmed', false);
      invitationObj.unset('arrivalAt');
    }

    const saved = await invitationObj.save();
    await saved.fetchWithInclude(['event', 'pelada', 'invitedBy', 'invitedUser', 'registration']);
    this.notifyChanged();
    return this.toInvitation(saved);
  }

  async confirmRemotePresence(invitationId: string, eventId: string): Promise<RefereeInvitation> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const invitationObj = await this.getInvitationForEvent(invitationId, eventId);
    if (invitationObj.get('status') !== 'accepted') {
      throw new Error('Presenca remota so pode ser confirmada apos aceitar o convite.');
    }
    if (invitationObj.get('attendanceMode') !== 'remote') {
      throw new Error('Este convite nao e de assistencia remota.');
    }

    const event = await this.eventService.getById(eventId);
    const isAdmin = !!event && this.eventService.isCurrentUserAdmin(event);
    const registration = await this.registrationService.getForEventAndUser(eventId, user.id!);
    const canConfirmRemote =
      isAdmin || (registration && ['cameraman', 'narrator'].includes(registration.role));
    if (!canConfirmRemote) {
      throw new Error('Apenas administrador, cinegrafista ou narrador do evento podem confirmar assistencia remota.');
    }

    invitationObj.set('presenceConfirmed', true);
    invitationObj.set('arrivalAt', new Date());

    const saved = await invitationObj.save();
    await saved.fetchWithInclude(['event', 'pelada', 'invitedBy', 'invitedUser', 'registration']);
    this.notifyChanged();
    return this.toInvitation(saved);
  }

  /** @deprecated Use setPaymentConfirmedByAdmin */
  async setWorkCompleted(
    invitationId: string,
    eventId: string,
    completed: boolean
  ): Promise<RefereeInvitation> {
    return this.setPaymentConfirmedByAdmin(invitationId, eventId, completed);
  }

  async confirmPaymentReceived(invitationId: string): Promise<RefereeInvitation> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const query = new Parse.Query(CLASS);
    query.include('event');
    query.include('pelada');
    query.include('invitedBy');
    query.include('invitedUser');
    const invitationObj = await query.get(invitationId);

    const invited = invitationObj.get('invitedUser') as Parse.User | undefined;
    if (invited?.id !== user.id) {
      throw new Error('Este convite nao pertence a voce.');
    }

    if (invitationObj.get('status') !== 'accepted') {
      throw new Error('Pagamento so pode ser confirmado apos aceitar o convite.');
    }

    const paymentSent =
      !!invitationObj.get('paymentConfirmedByAdmin') || !!invitationObj.get('paymentReleased');
    if (!paymentSent) {
      throw new Error('O administrador ainda nao confirmou o pagamento.');
    }

    if (invitationObj.get('paymentConfirmedByReferee')) {
      throw new Error('Pagamento ja foi confirmado.');
    }

    invitationObj.set('paymentConfirmedByReferee', true);
    invitationObj.set('paymentConfirmedByRefereeAt', new Date());

    const saved = await invitationObj.save();
    await saved.fetchWithInclude(['event', 'pelada', 'invitedBy', 'invitedUser', 'registration']);
    this.notifyChanged();
    return this.toInvitation(saved);
  }

  private async expirePendingPastDeadline(filter?: {
    eventId?: string;
    invitedUserId?: string;
  }): Promise<void> {
    const query = new Parse.Query(CLASS);
    query.equalTo('status', 'pending');
    query.lessThan('responseDeadline', new Date());
    query.limit(200);

    if (filter?.eventId) {
      query.equalTo('event', Parse.Object.extend(EVENT_CLASS).createWithoutData(filter.eventId));
    }
    if (filter?.invitedUserId) {
      query.equalTo('invitedUser', Parse.User.createWithoutData(filter.invitedUserId));
    }

    const results = await query.find();
    if (!results.length) return;

    for (const row of results) {
      row.set('status', 'cancelled');
    }
    await Parse.Object.saveAll(results);
    this.notifyChanged();
  }

  private async releasePayment(invitationObj: Parse.Object): Promise<void> {
    const pelada = invitationObj.get('pelada') as Parse.Object | undefined;
    const event = invitationObj.get('event') as Parse.Object | undefined;
    const invitedUser = invitationObj.get('invitedUser') as Parse.User | undefined;
    if (!pelada?.id || !event) return;

    const amount = Number(invitationObj.get('offeredAmount') ?? 0);
    if (amount <= 0) {
      invitationObj.set('paymentReleased', true);
      await invitationObj.save();
      return;
    }

    const role = (invitationObj.get('role') as ProfileRole | undefined) ?? 'referee';
    const invitedApelido =
      (invitationObj.get('invitedUserApelido') as string) ||
      (invitedUser?.get('apelido') as string) ||
      '';
    const inviteeName =
      invitedApelido ||
      (invitationObj.get('invitedUserFullName') as string) ||
      (invitedUser?.get('name') as string) ||
      invitedUser?.getUsername() ||
      hireableRoleLabel(role as HireableRole);
    const eventName = (event.get('name') as string) || 'Evento';

    const entry = await this.cashService.create(pelada.id!, {
      date: new Date(),
      type: 'out',
      amount,
      description: `Saida - Pagamento ${hireableRoleLabel(role as HireableRole)} - ${eventName} - ${inviteeName}`,
      refereeInvitationId: invitationObj.id,
    });

    invitationObj.set('paymentReleased', true);
    invitationObj.set('cashEntryId', entry.objectId);
    await invitationObj.save();
  }

  private applyInvitedByDisplayFields(invitation: Parse.Object, user: Parse.User): void {
    const apelido = ((user.get('apelido') as string) || '').trim();
    const fullName = ((user.get('name') as string) || '').trim();
    invitation.set('invitedByApelido', apelido);
    invitation.set('invitedByFullName', fullName);
    invitation.set('invitedByName', apelido || fullName || user.getUsername() || 'Administrador');
    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) {
      invitation.set('invitedByAvatarUrl', avatarUrl);
    }
  }

  private applyInvitedUserDisplayFields(invitation: Parse.Object, user: Parse.User): void {
    const apelido = ((user.get('apelido') as string) || '').trim();
    const fullName = ((user.get('name') as string) || '').trim();
    invitation.set('invitedUserApelido', apelido);
    invitation.set('invitedUserFullName', fullName);
    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) {
      invitation.set('invitedUserAvatarUrl', avatarUrl);
    }
  }

  private async assertEventAdmin(eventId: string): Promise<void> {
    const event = await this.eventService.getById(eventId);
    if (!event || !this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador do evento pode executar esta acao.');
    }
  }

  private async getInvitationForEvent(invitationId: string, eventId: string): Promise<Parse.Object> {
    const query = new Parse.Query(CLASS);
    query.equalTo('event', Parse.Object.extend(EVENT_CLASS).createWithoutData(eventId));
    return query.get(invitationId);
  }

  private notifyChanged(): void {
    this.changed$.next();
  }

  /** Dispara atualizacao do badge na barra superior (sem alterar convites). */
  notifyBadgeRefresh(): void {
    this.changed$.next();
  }

  private toInvitation(obj: Parse.Object): RefereeInvitation {
    const event = obj.get('event') as Parse.Object | undefined;
    const pelada = obj.get('pelada') as Parse.Object | undefined;
    const invitedBy = obj.get('invitedBy') as Parse.User | undefined;
    const invitedUser = obj.get('invitedUser') as Parse.User | undefined;
    const registration = obj.get('registration') as Parse.Object | undefined;

    const invitedApelido =
      (obj.get('invitedUserApelido') as string | undefined)?.trim() ||
      (invitedUser?.get('apelido') as string) ||
      '';
    const invitedFullName =
      (obj.get('invitedUserFullName') as string | undefined)?.trim() ||
      (invitedUser?.get('name') as string) ||
      '';
    const role = (obj.get('role') as ProfileRole | undefined) ?? 'referee';
    const invitedName =
      invitedApelido ||
      invitedFullName ||
      invitedUser?.getUsername() ||
      PROFILE_ROLE_LABELS[role];
    const invitedAvatarUrl =
      (obj.get('invitedUserAvatarUrl') as string | undefined)?.trim() ||
      getUserAvatarUrl(invitedUser, this.parseFileService) ||
      undefined;

    const invitedByApelido =
      (obj.get('invitedByApelido') as string | undefined)?.trim() ||
      (invitedBy?.get('apelido') as string) ||
      '';
    const invitedByFullName =
      (obj.get('invitedByFullName') as string | undefined)?.trim() ||
      (invitedBy?.get('name') as string) ||
      '';
    const invitedByAvatarUrl =
      (obj.get('invitedByAvatarUrl') as string | undefined)?.trim() ||
      getUserAvatarUrl(invitedBy, this.parseFileService) ||
      undefined;
    const invitedByName =
      invitedByApelido ||
      invitedByFullName ||
      (obj.get('invitedByName') as string) ||
      invitedBy?.getUsername() ||
      'Administrador';

    const paymentConfirmedByAdmin =
      !!obj.get('paymentConfirmedByAdmin') || !!obj.get('workCompleted');

    return {
      objectId: obj.id!,
      eventId: event?.id ?? '',
      eventName: (event?.get('name') as string) || 'Evento',
      eventType: (event?.get('type') as string) || '',
      eventStartTime: (event?.get('startTime') as Date) ?? new Date(),
      peladaId: pelada?.id ?? '',
      peladaName: pelada?.get('name') as string | undefined,
      role,
      attendanceMode: obj.get('attendanceMode') as RefereeInvitation['attendanceMode'],
      invitedUserId: invitedUser?.id ?? '',
      invitedUserName: invitedName,
      invitedUserApelido: invitedApelido,
      invitedUserFullName: invitedFullName || undefined,
      invitedUserAvatarUrl: invitedAvatarUrl,
      invitedById: invitedBy?.id ?? '',
      invitedByName: invitedByName,
      invitedByApelido: invitedByApelido || undefined,
      invitedByFullName: invitedByFullName || undefined,
      invitedByAvatarUrl: invitedByAvatarUrl,
      status: obj.get('status') as RefereeInvitationStatus,
      offeredAmount: Number(obj.get('offeredAmount') ?? 0),
      responseDeadline: obj.get('responseDeadline') as Date | undefined,
      responseAt: obj.get('responseAt') as Date | undefined,
      registrationId: registration?.id,
      presenceConfirmed: !!obj.get('presenceConfirmed'),
      arrivalAt: obj.get('arrivalAt') as Date | undefined,
      paymentConfirmedByAdmin,
      paymentConfirmedByReferee: !!obj.get('paymentConfirmedByReferee'),
      paymentConfirmedByRefereeAt: obj.get('paymentConfirmedByRefereeAt') as Date | undefined,
      excusedFault: !!obj.get('excusedFault'),
      workCompleted: paymentConfirmedByAdmin,
      paymentReleased: !!obj.get('paymentReleased'),
      cashEntryId: obj.get('cashEntryId') as string | undefined,
      createdAt: obj.get('createdAt') as Date | undefined,
      supplementaryKind: obj.get('supplementaryKind') as RefereeInvitation['supplementaryKind'],
    };
  }
}

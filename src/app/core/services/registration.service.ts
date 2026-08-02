import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import {
  computeEffectiveConfirmation,
  eventsOverlap,
  getRegistrationStatus,
  getRegistrationStatusLabel,
  PeladaEvent,
} from '../models/event.model';
import {
  EventRegistration,
  EventRegistrationListItem,
  MembershipType,
  RegisterForEventPayload,
  ScheduleConflict,
} from '../models/event-registration.model';
import { PeladaParticipant } from '../models/pelada-participant.model';
import { ProfileRole, PROFILE_ROLE_LABELS } from '../models/profile-role.model';
import { isInvalidCloudFunctionError, parseErrorMessage } from '../utils/parse-error.util';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { EventService } from './event.service';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';
import { PeladaMonthlyFeeService } from './pelada-monthly-fee.service';
import { PeladaService } from './pelada.service';
import { ProfilePresentationRequestService } from './profile-presentation-request.service';
import { EventGateTicketService } from './event-gate-ticket.service';

const CLASS = 'EventRegistration';
const EVENT_CLASS = 'Event';
const EventPointer = Parse.Object.extend(EVENT_CLASS);
const AthletePointer = Parse.Object.extend('AthleteProfile');

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly registrationsChanged$ = new Subject<void>();

  readonly onRegistrationsChanged = this.registrationsChanged$.asObservable();

  constructor(
    private readonly parseService: ParseService,
    private readonly eventService: EventService,
    private readonly parseFileService: ParseFileService,
    private readonly peladaService: PeladaService,
    private readonly monthlyFeeService: PeladaMonthlyFeeService,
    private readonly gateTicketService: EventGateTicketService,
    private readonly profilePresentationService: ProfilePresentationRequestService
  ) {
    this.parseService.init();
  }

  async getParticipatedEventIds(): Promise<{ participated: Set<string>; member: Set<string> }> {
    const user = Parse.User.current();
    const participated = new Set<string>();
    const member = new Set<string>();
    if (!user) return { participated, member };

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    query.limit(500);
    const results = await query.find();

    for (const row of results) {
      const event = row.get('event') as Parse.Object | undefined;
      if (!event?.id) continue;
      participated.add(event.id);
      if (row.get('membershipType') === 'socio') {
        member.add(event.id);
      }
    }

    return { participated, member };
  }

  async getForEvent(eventId: string): Promise<EventRegistration | null> {
    const user = Parse.User.current();
    if (!user) return null;

    return this.getForEventAndUser(eventId, user.id!);
  }

  async getForEventAndUser(eventId: string, userId: string): Promise<EventRegistration | null> {
    const query = new Parse.Query(CLASS);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.equalTo('user', Parse.User.createWithoutData(userId));
    query.include('event');
    const result = await query.first();
    return result ? this.toRegistration(result) : null;
  }

  async listParticipantsForPelada(peladaId: string): Promise<PeladaParticipant[]> {
    const pelada = await this.peladaService.getById(peladaId);
    if (pelada && this.peladaService.isCurrentUserAdmin(pelada)) {
      const fromCloud = await this.listParticipantsForPeladaViaCloud(peladaId);
      if (fromCloud) {
        return fromCloud;
      }
    }

    return this.listParticipantsForPeladaClient(peladaId);
  }

  private async listParticipantsForPeladaViaCloud(peladaId: string): Promise<PeladaParticipant[] | null> {
    try {
      const rows = await Parse.Cloud.run('listPeladaEventParticipants', { peladaId });
      if (!Array.isArray(rows)) {
        return null;
      }
      return rows as PeladaParticipant[];
    } catch {
      return null;
    }
  }

  private async listParticipantsForPeladaClient(peladaId: string): Promise<PeladaParticipant[]> {
    const eventQuery = new Parse.Query(EVENT_CLASS);
    eventQuery.equalTo('pelada', Parse.Object.extend('Pelada').createWithoutData(peladaId));
    eventQuery.limit(200);
    const events = await eventQuery.find();
    const eventIds = events.map((event) => event.id!).filter(Boolean);

    const registrationMap = new Map<string, Parse.Object>();

    const byPeladaIdQuery = new Parse.Query(CLASS);
    byPeladaIdQuery.equalTo('peladaId', peladaId);
    byPeladaIdQuery.limit(2000);
    const byPeladaId = await byPeladaIdQuery.find();
    for (const row of byPeladaId) {
      if (row.id) registrationMap.set(row.id, row);
    }

    if (eventIds.length) {
      const byEventQuery = new Parse.Query(CLASS);
      byEventQuery.containedIn(
        'event',
        eventIds.map((id) => EventPointer.createWithoutData(id))
      );
      byEventQuery.limit(2000);
      const byEvent = await byEventQuery.find();
      for (const row of byEvent) {
        if (row.id) registrationMap.set(row.id, row);
      }
    }

    const byUser = new Map<string, PeladaParticipant>();
    for (const row of registrationMap.values()) {
      const participant = this.buildPeladaParticipantFromRegistration(row);
      if (!participant) continue;

      const existing = byUser.get(participant.userId);
      if (existing) {
        for (const role of participant.roles) {
          if (!existing.roles.includes(role)) {
            existing.roles.push(role);
          }
        }
        if (!existing.apelido && participant.apelido) {
          existing.apelido = participant.apelido;
        }
        if (!existing.fullName && participant.fullName) {
          existing.fullName = participant.fullName;
        }
        if (!existing.avatarUrl && participant.avatarUrl) {
          existing.avatarUrl = participant.avatarUrl;
        }
      } else {
        byUser.set(participant.userId, participant);
      }
    }

    return Array.from(byUser.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName, 'pt-BR')
    );
  }

  async listRecentParticipants(limit = 500): Promise<PeladaParticipant[]> {
    const query = new Parse.Query(CLASS);
    query.include('user');
    query.descending('createdAt');
    query.limit(limit);
    const results = await query.find();

    const byUser = new Map<string, PeladaParticipant>();
    for (const row of results) {
      const user = row.get('user') as Parse.User | undefined;
      if (!user?.id) continue;
      const role = row.get('role') as ProfileRole;
      const apelido = (row.get('apelido') as string) || (user.get('apelido') as string) || '';
      const userName =
        apelido ||
        (user.get('name') as string) ||
        user.getUsername() ||
        'Participante';
      const existing = byUser.get(user.id);
      if (existing) {
        if (!existing.roles.includes(role)) existing.roles.push(role);
      } else {
        byUser.set(user.id, this.buildPeladaParticipant(user, role, apelido));
      }
    }

    return Array.from(byUser.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName, 'pt-BR')
    );
  }

  async listParticipantsForEvent(eventId: string): Promise<PeladaParticipant[]> {
    const fromCloud = await this.listParticipantsForEventViaCloud(eventId);
    if (fromCloud !== null) {
      return fromCloud;
    }

    const query = new Parse.Query(CLASS);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.limit(500);
    const results = await query.find();

    const byUser = new Map<string, PeladaParticipant>();
    for (const row of results) {
      const participant = this.buildPeladaParticipantFromRegistration(row);
      if (!participant) continue;

      const existing = byUser.get(participant.userId);
      if (existing) {
        for (const role of participant.roles) {
          if (!existing.roles.includes(role)) existing.roles.push(role);
        }
      } else {
        byUser.set(participant.userId, participant);
      }
    }

    const participants = Array.from(byUser.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName, 'pt-BR')
    );

    return this.enrichParticipantsFromRegistrations(eventId, participants);
  }

  private async listParticipantsForEventViaCloud(
    eventId: string
  ): Promise<PeladaParticipant[] | null> {
    try {
      const rows = await Parse.Cloud.run('listEventMuralParticipants', { eventId });
      if (!Array.isArray(rows)) {
        return null;
      }
      return rows.map((row) => ({
        userId: String(row['userId'] || ''),
        userName: String(row['userName'] || 'Participante'),
        apelido: String(row['apelido'] || ''),
        fullName: row['fullName'] ? String(row['fullName']) : undefined,
        roles: Array.isArray(row['roles']) ? (row['roles'] as ProfileRole[]) : ['athlete'],
        avatarUrl: row['avatarUrl'] ? String(row['avatarUrl']) : undefined,
        birthDate: row['birthDate'] ? new Date(String(row['birthDate'])) : undefined,
        address: row['address'] as PeladaParticipant['address'],
        proFootballIdol: row['proFootballIdol'] ? String(row['proFootballIdol']) : undefined,
        amateurFootballIdol: row['amateurFootballIdol']
          ? String(row['amateurFootballIdol'])
          : undefined,
      }));
    } catch {
      return null;
    }
  }

  private async enrichParticipantsFromRegistrations(
    eventId: string,
    participants: PeladaParticipant[]
  ): Promise<PeladaParticipant[]> {
    const query = new Parse.Query(CLASS);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.include('user');
    query.limit(500);
    const registrations = await query.find();
    const metaByUserId = new Map<string, PeladaParticipant>();

    for (const row of registrations) {
      const built = this.buildPeladaParticipantFromRegistration(row);
      if (!built?.userId) continue;
      const existing = metaByUserId.get(built.userId);
      if (existing) {
        for (const role of built.roles) {
          if (!existing.roles.includes(role)) existing.roles.push(role);
        }
        if (!existing.avatarUrl && built.avatarUrl) existing.avatarUrl = built.avatarUrl;
        if (!existing.apelido && built.apelido) existing.apelido = built.apelido;
        if (!existing.birthDate && built.birthDate) existing.birthDate = built.birthDate;
        if (!existing.address && built.address) existing.address = built.address;
        continue;
      }
      metaByUserId.set(built.userId, built);
    }

    if (!participants.length) {
      return Array.from(metaByUserId.values()).sort((a, b) =>
        a.userName.localeCompare(b.userName, 'pt-BR')
      );
    }

    return participants.map((participant) => {
      const meta = metaByUserId.get(participant.userId);
      if (!meta) return participant;
      return {
        ...participant,
        ...meta,
        roles: [...new Set([...participant.roles, ...meta.roles])],
        avatarUrl: participant.avatarUrl || meta.avatarUrl,
        apelido: participant.apelido || meta.apelido,
        userName: participant.apelido || participant.userName || meta.userName,
        birthDate: participant.birthDate || meta.birthDate,
        address: participant.address || meta.address,
        proFootballIdol: participant.proFootballIdol || meta.proFootballIdol,
        amateurFootballIdol: participant.amateurFootballIdol || meta.amateurFootballIdol,
      };
    });
  }

  async listForEvent(eventId: string): Promise<EventRegistrationListItem[]> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');

    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador pode ver a lista completa de participantes.');
    }

    const fromCloud = await this.listForEventViaCloud(eventId);
    if (fromCloud !== null) {
      return fromCloud;
    }

    return this.fetchParticipantsForEvent(eventId);
  }

  private async listForEventViaCloud(
    eventId: string
  ): Promise<EventRegistrationListItem[] | null> {
    try {
      const rows = await Parse.Cloud.run('listEventRegistrationsForAdmin', { eventId });
      if (!Array.isArray(rows)) {
        return null;
      }
      return rows.map((row) => this.cloudRowToRegistrationListItem(row));
    } catch {
      return null;
    }
  }

  async listPublicForEvent(eventId: string): Promise<EventRegistrationListItem[]> {
    const fromCloud = await this.listPublicForEventViaCloud(eventId);
    if (fromCloud !== null) {
      return fromCloud;
    }

    const all = await this.fetchParticipantsForEvent(eventId);
    return all.filter((participant) => participant.isEffectivelyConfirmed);
  }

  async resolveUserIdForEventRegistration(
    eventId: string,
    registrationId: string
  ): Promise<string> {
    const query = new Parse.Query(CLASS);
    query.equalTo('objectId', registrationId);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.select('participantUserId', 'user');
    const registration = await query.first();
    if (!registration) {
      return '';
    }

    return this.resolveParticipantUserId(registration);
  }

  private async listPublicForEventViaCloud(
    eventId: string
  ): Promise<EventRegistrationListItem[] | null> {
    try {
      const rows = await Parse.Cloud.run('listEventParticipantsForVoting', { eventId });
      if (!Array.isArray(rows)) {
        return null;
      }
      return rows.map((row) => this.cloudRowToRegistrationListItem(row));
    } catch {
      return null;
    }
  }

  private cloudRowToRegistrationListItem(row: Record<string, unknown>): EventRegistrationListItem {
    const arrivedAtRaw = row['arrivedAt'];
    const presentationRaw = row['profilePresentationStatus'];
    const profilePresentationStatus =
      presentationRaw === 'pending' ||
      presentationRaw === 'approved' ||
      presentationRaw === 'rejected'
        ? presentationRaw
        : undefined;
    return {
      objectId: String(row['objectId'] || ''),
      eventId: String(row['eventId'] || ''),
      userId: String(row['userId'] || ''),
      userName: String(row['userName'] || 'Participante'),
      apelido: String(row['apelido'] || ''),
      role: (row['role'] as EventRegistrationListItem['role']) || 'athlete',
      committed: !!row['committed'],
      membershipType: (row['membershipType'] as EventRegistrationListItem['membershipType']) || 'convidado',
      attendance: (row['attendance'] as EventRegistrationListItem['attendance']) || 'pending',
      paymentConfirmed: !!row['paymentConfirmed'],
      paymentExempt: !!row['paymentExempt'],
      isEffectivelyConfirmed: !!row['isEffectivelyConfirmed'],
      invitedByContract: !!row['invitedByContract'],
      invitedAsReferee: !!row['invitedAsReferee'],
      profilePresentationStatus,
      arrivalOrder:
        row['arrivalOrder'] != null ? Number(row['arrivalOrder']) : undefined,
      arrivedAt: arrivedAtRaw ? new Date(String(arrivedAtRaw)) : undefined,
      avatarUrl: row['avatarUrl'] ? String(row['avatarUrl']) : undefined,
      primaryPosition: row['primaryPosition'] ? String(row['primaryPosition']) : undefined,
      isAnonymous: !!row['isAnonymous'],
      gateTicketActive: !!row['gateTicketActive'],
    };
  }

  async syncAvatarUrlForCurrentUser(avatarUrl: string): Promise<void> {
    const user = Parse.User.current();
    const normalizedUrl = avatarUrl.trim();
    if (!user || !normalizedUrl) return;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    query.limit(500);
    const rows = await query.find();
    const toSave = rows.filter((row) => row.get('avatarUrl') !== normalizedUrl);
    for (const row of toSave) {
      row.set('avatarUrl', normalizedUrl);
    }
    if (toSave.length) {
      await Parse.Object.saveAll(toSave);
    }
  }

  private async fetchParticipantsForEvent(eventId: string): Promise<EventRegistrationListItem[]> {
    const query = new Parse.Query(CLASS);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.include('user');
    query.include('athlete');
    query.ascending('arrivalOrder');
    query.addAscending('apelido');
    query.limit(500);
    const results = await query.find();

    return this.enrichRegistrationAvatars(
      results.map((obj) => this.toRegistrationListItem(obj))
    );
  }

  private async persistMissingParticipantUserIds(registrations: Parse.Object[]): Promise<void> {
    const missing = registrations.filter((row) => {
      const explicit = (row.get('participantUserId') as string | undefined)?.trim();
      if (explicit) return false;
      return !!this.resolveParticipantUserId(row);
    });
    if (!missing.length) return;

    for (const row of missing) {
      const userId = this.resolveParticipantUserId(row);
      if (userId) {
        row.set('participantUserId', userId);
      }
    }

    try {
      await Parse.Object.saveAll(missing);
    } catch {
      // Falha ao denormalizar nao impede a leitura da lista.
    }
  }

  private async persistMissingAthleteProfiles(registrations: Parse.Object[]): Promise<void> {
    const missing = registrations.filter((row) => {
      const role = row.get('role') as ProfileRole;
      if (role !== 'athlete') return false;
      const athlete = row.get('athlete') as Parse.Object | undefined;
      if (athlete?.get?.('primaryPosition')) return false;
      return !!row.get('user');
    });
    if (!missing.length) return;

    const users = missing
      .map((row) => row.get('user') as Parse.User | undefined)
      .filter((user): user is Parse.User => !!user?.id);
    if (!users.length) return;

    const profileQuery = new Parse.Query('AthleteProfile');
    profileQuery.containedIn('user', users);
    profileQuery.limit(users.length);
    const profiles = await profileQuery.find();
    const profileByUserId = new Map<string, Parse.Object>();
    for (const profile of profiles) {
      const user = profile.get('user') as Parse.User | undefined;
      if (user?.id) profileByUserId.set(user.id, profile);
    }

    const toSave: Parse.Object[] = [];
    for (const row of missing) {
      const user = row.get('user') as Parse.User | undefined;
      if (!user?.id) continue;
      const profile = profileByUserId.get(user.id);
      if (!profile) continue;
      row.set('athlete', profile);
      toSave.push(row);
    }

    if (!toSave.length) return;

    try {
      await Parse.Object.saveAll(toSave);
    } catch {
      // Falha ao vincular perfil nao impede a leitura da lista.
    }
  }

  private async attachAthleteProfile(registration: Parse.Object, user: Parse.User): Promise<void> {
    const profile = await new Parse.Query('AthleteProfile').equalTo('user', user).first();
    if (profile) {
      registration.set('athlete', profile);
    }
  }

  private resolveParticipantUserId(obj: Parse.Object): string {
    const explicit = (obj.get('participantUserId') as string | undefined)?.trim();
    if (explicit) {
      return explicit;
    }

    const user = obj.get('user') as Parse.User | Parse.Object | undefined;
    if (user?.id) {
      return user.id;
    }

    const objectId = (user as { objectId?: string } | undefined)?.objectId;
    if (objectId) {
      return String(objectId);
    }

    const raw = this.readRawRegistrationField(obj, 'user');
    if (raw && typeof raw === 'object' && 'objectId' in raw) {
      return String((raw as { objectId: string }).objectId);
    }

    try {
      const json = obj.toJSON() as Record<string, unknown>;
      const userJson = json['user'];
      if (userJson && typeof userJson === 'object' && userJson !== null && 'objectId' in userJson) {
        return String((userJson as { objectId: string }).objectId);
      }
    } catch {
      // Ignora falha de serializacao local.
    }

    return '';
  }

  private readRawRegistrationField(obj: Parse.Object, field: string): unknown {
    const withServerData = obj as Parse.Object & { _serverData?: Record<string, unknown> };
    if (withServerData._serverData && field in withServerData._serverData) {
      return withServerData._serverData[field];
    }

    const withAttributes = obj as Parse.Object & { attributes?: Record<string, unknown> };
    if (withAttributes.attributes && field in withAttributes.attributes) {
      return withAttributes.attributes[field];
    }

    return undefined;
  }

  private async persistMissingRegistrationAvatars(registrations: Parse.Object[]): Promise<void> {
    const missing = registrations.filter((row) => {
      const url = (row.get('avatarUrl') as string | undefined)?.trim();
      return !url;
    });
    if (!missing.length) return;

    const userIds = [
      ...new Set(
        missing
          .map((row) => (row.get('user') as Parse.User | undefined)?.id)
          .filter((userId): userId is string => !!userId)
      ),
    ];
    if (!userIds.length) return;

    try {
      const userQuery = new Parse.Query(Parse.User);
      userQuery.containedIn('objectId', userIds);
      userQuery.limit(userIds.length);
      const users = await userQuery.find();

      const avatarByUserId = new Map<string, string>();
      for (const user of users) {
        const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
        if (avatarUrl) avatarByUserId.set(user.id!, avatarUrl);
      }

      const toSave: Parse.Object[] = [];
      for (const row of missing) {
        const userId = (row.get('user') as Parse.User | undefined)?.id;
        if (!userId) continue;
        const avatarUrl = avatarByUserId.get(userId);
        if (!avatarUrl) continue;
        row.set('avatarUrl', avatarUrl);
        toSave.push(row);
      }

      if (toSave.length) {
        await Parse.Object.saveAll(toSave);
      }
    } catch {
      // CLP pode impedir leitura em lote de outros usuarios.
    }
  }

  private async enrichRegistrationAvatars(
    items: EventRegistrationListItem[]
  ): Promise<EventRegistrationListItem[]> {
    if (!items.length) return items;

    const avatarByUserId = new Map<string, string>();
    for (const item of items) {
      if (item.userId && item.avatarUrl) {
        avatarByUserId.set(item.userId, item.avatarUrl);
      }
    }

    const missingIds = [
      ...new Set(
        items
          .map((item) => item.userId)
          .filter((userId) => userId && !avatarByUserId.has(userId))
      ),
    ];

    if (missingIds.length) {
      try {
        const query = new Parse.Query(Parse.User);
        query.containedIn('objectId', missingIds);
        query.limit(missingIds.length);
        const users = await query.find();
        for (const user of users) {
          const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
          if (avatarUrl) avatarByUserId.set(user.id!, avatarUrl);
        }
      } catch {
        // Ignora quando a CLP bloqueia leitura em lote.
      }
    }

    const currentUser = Parse.User.current();
    if (currentUser?.id) {
      const currentAvatar = getUserAvatarUrl(currentUser, this.parseFileService);
      if (currentAvatar) avatarByUserId.set(currentUser.id, currentAvatar);
    }

    return items.map((item) => {
      const avatarUrl = avatarByUserId.get(item.userId);
      return avatarUrl ? { ...item, avatarUrl } : item;
    });
  }

  async setPaymentConfirmed(
    eventId: string,
    registrationId: string,
    paymentConfirmed: boolean
  ): Promise<EventRegistrationListItem> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');

    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador pode confirmar pagamentos.');
    }

    return this.updateRegistrationPayment(event, registrationId, 'confirmed', paymentConfirmed);
  }

  async setPaymentExempt(
    eventId: string,
    registrationId: string,
    paymentExempt: boolean
  ): Promise<EventRegistrationListItem> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');

    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador pode isentar pagamentos.');
    }

    return this.updateRegistrationPayment(event, registrationId, 'exempt', paymentExempt);
  }

  private async updateRegistrationPayment(
    event: PeladaEvent,
    registrationId: string,
    mode: 'confirmed' | 'exempt',
    value: boolean
  ): Promise<EventRegistrationListItem> {
    try {
      const result = await Parse.Cloud.run('updateEventRegistrationPayment', {
        eventId: event.objectId,
        registrationId,
        mode,
        value,
      });
      this.notifyRegistrationsChanged();
      return this.mapCloudRegistrationListItem(result);
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        const updated = await this.updateRegistrationPaymentClient(
          event,
          registrationId,
          mode,
          value
        );
        await this.tryIssueGateTicketAfterPayment(event, registrationId, updated);
        return updated;
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  private async updateRegistrationPaymentClient(
    event: PeladaEvent,
    registrationId: string,
    mode: 'confirmed' | 'exempt',
    value: boolean
  ): Promise<EventRegistrationListItem> {
    const query = new Parse.Query(CLASS);
    query.equalTo('objectId', registrationId);
    query.equalTo('event', EventPointer.createWithoutData(event.objectId));
    query.include('user');
    query.include('athlete');
    const registration = await query.first();
    if (!registration) {
      throw new Error('Inscricao nao encontrada.');
    }

    const participationFee = Number(event.participationFee ?? 0);

    if (mode === 'exempt') {
      registration.set('paymentExempt', value);
      if (value) {
        registration.set('paymentConfirmed', false);
      }
    } else {
      registration.set('paymentConfirmed', value);
      if (value) {
        registration.set('paymentExempt', false);
      }
    }

    const paymentConfirmed = !!registration.get('paymentConfirmed');
    const paymentExempt = !!registration.get('paymentExempt');
    const profilePresentationStatus = registration.get('profilePresentationStatus') as
      | 'pending'
      | 'approved'
      | 'rejected'
      | null
      | undefined;
    registration.set(
      'isEffectivelyConfirmed',
      computeEffectiveConfirmation(participationFee, paymentConfirmed, paymentExempt, {
        invitedByContract: !!registration.get('invitedByContract'),
        invitedAsReferee: !!registration.get('invitedAsReferee'),
        isAnonymous: !!registration.get('isAnonymous'),
        profilePresentationStatus,
      })
    );

    try {
      const saved = await registration.save();
      this.notifyRegistrationsChanged();
      return this.toRegistrationListItem(saved);
    } catch (saveError: unknown) {
      throw new Error(parseErrorMessage(saveError));
    }
  }

  private async tryIssueGateTicketAfterPayment(
    event: PeladaEvent,
    registrationId: string,
    participant: EventRegistrationListItem
  ): Promise<void> {
    if (!event.gateTicketControlEnabled || !participant.isEffectivelyConfirmed) {
      return;
    }
    try {
      await this.gateTicketService.issueTicket(event.objectId, registrationId);
    } catch {
      // Ignora falha de emissao automatica; admin pode emitir manualmente depois.
    }
  }

  async createAnonymousRegistration(
    eventId: string,
    apelido: string,
    role: ProfileRole
  ): Promise<EventRegistrationListItem> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');

    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador pode adicionar participantes anonimos.');
    }

    try {
      const result = await Parse.Cloud.run('createAnonymousEventRegistration', {
        eventId,
        apelido,
        role,
      });
      this.notifyRegistrationsChanged();
      return this.mapCloudRegistrationListItem(result);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async registerAthleteArrival(
    eventId: string,
    registrationId: string,
    action: 'check_in' | 'undo'
  ): Promise<EventRegistrationListItem[]> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');

    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador pode registrar chegada.');
    }

    try {
      await Parse.Cloud.run('registerEventAthleteArrival', {
        eventId,
        registrationId,
        action,
      });
      this.notifyRegistrationsChanged();
      return this.listForEvent(eventId);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async ensureArrivalOrders(eventId: string): Promise<void> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');

    if (!this.eventService.isCurrentUserAdmin(event)) {
      return;
    }

    try {
      await Parse.Cloud.run('ensureEventArrivalOrders', { eventId });
    } catch {
      // Cloud Code pode ainda nao estar publicado; a lista continua utilizavel.
    }
  }

  formatMembershipType(type: MembershipType): string {
    return type === 'socio' ? 'Socio' : 'Convidado';
  }

  formatArrivedAt(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  async findScheduleConflict(
    eventId: string,
    startTime: Date,
    endTime: Date
  ): Promise<ScheduleConflict | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    query.include('event');
    query.limit(500);
    const registrations = await query.find();

    for (const registration of registrations) {
      const event = registration.get('event') as Parse.Object | undefined;
      if (!event?.id || event.id === eventId) continue;

      const otherStart = event.get('startTime') as Date;
      const otherEnd = event.get('endTime') as Date;
      if (!otherStart || !otherEnd) continue;

      if (eventsOverlap(startTime, endTime, otherStart, otherEnd)) {
        return {
          eventId: event.id,
          eventName: (event.get('name') as string) || 'Outro evento',
          startTime: otherStart,
          endTime: otherEnd,
        };
      }
    }

    return null;
  }

  async isApelidoTakenInEvent(eventId: string, apelido: string): Promise<boolean> {
    const normalized = apelido.trim();
    if (!normalized) return false;

    const query = new Parse.Query(CLASS);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.equalTo('apelido', normalized);
    const count = await query.count();
    return count > 0;
  }

  async register(payload: RegisterForEventPayload): Promise<EventRegistration> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para se inscrever.');

    const apelido = payload.apelido.trim();
    if (apelido.length < 2) {
      throw new Error('Informe um apelido (minimo 2 caracteres).');
    }

    if (payload.role === 'referee') {
      throw new Error('Arbitros sao convidados pelo administrador do evento.');
    }

    if (!payload.committed) {
      throw new Error('Confirme o compromisso de participacao.');
    }

    const existing = await this.getForEvent(payload.eventId);
    if (existing) {
      throw new Error('Voce ja esta inscrito neste evento.');
    }

    if (await this.isApelidoTakenInEvent(payload.eventId, apelido)) {
      throw new Error('Apelido ja utilizado neste evento. Escolha outro.');
    }

    const eventQuery = new Parse.Query(EVENT_CLASS);
    eventQuery.include('pelada');
    const targetEvent = await eventQuery.get(payload.eventId);
    const startTime = targetEvent.get('startTime') as Date;
    const endTime = targetEvent.get('endTime') as Date;
    const registrationOpensAt = (targetEvent.get('registrationOpensAt') as Date) ?? new Date(0);
    const registrationClosesAt = (targetEvent.get('registrationClosesAt') as Date) ?? startTime;
    const registrationStatus = getRegistrationStatus(registrationOpensAt, registrationClosesAt);
    const participationFee = Number(targetEvent.get('participationFee') ?? 0);

    if (registrationStatus !== 'open') {
      throw new Error(
        `As inscricoes estao ${getRegistrationStatusLabel(registrationStatus).toLowerCase()}.`
      );
    }

    const conflict = await this.findScheduleConflict(payload.eventId, startTime, endTime);
    if (conflict) {
      throw new Error(this.formatScheduleConflictMessage(conflict));
    }

    const pelada = targetEvent.get('pelada') as Parse.Object | undefined;
    let peladaObj: Parse.Object | null = null;
    if (pelada?.id) {
      peladaObj = await new Parse.Query('Pelada').get(pelada.id);
      await this.assertNotBannedFromPelada(peladaObj, user.id!);
    }

    if (payload.role === 'athlete') {
      const eventMaxAthletes = Number(targetEvent.get('maxAthletesPerEvent') ?? 0);
      const peladaMaxAthletes = peladaObj ? Number(peladaObj.get('maxAthletesPerEvent') ?? 0) : 0;
      const maxAthletes = eventMaxAthletes > 0 ? eventMaxAthletes : peladaMaxAthletes;

      if (maxAthletes > 0) {
        const countQuery = new Parse.Query(CLASS);
        countQuery.equalTo('event', targetEvent);
        countQuery.equalTo('role', 'athlete');
        countQuery.equalTo('isEffectivelyConfirmed', true);
        const count = await countQuery.count();
        if (count >= maxAthletes) {
          throw new Error(`Limite de ${maxAthletes} atletas confirmados atingido neste evento.`);
        }
      }
    }

    const paymentConfirmed = false;
    let paymentExempt = false;
    if (
      peladaObj?.get('socioGoodStandingPaymentExempt') &&
      payload.membershipType === 'socio' &&
      pelada?.id
    ) {
      const inGoodStanding = await this.monthlyFeeService.isSocioInGoodStanding(
        pelada.id,
        user.id!
      );
      if (inGoodStanding) {
        paymentExempt = true;
      }
    }

    const needsProfilePresentation =
      (await this.profilePresentationService.checkProfilePresentationRequired(payload.eventId)) ||
      (!!(peladaObj?.get('requireProfilePresentationOnFirstEvent') &&
        !!pelada?.id &&
        !(await this.hasApprovedPeladaParticipation(pelada.id, user.id!))));

    const isEffectivelyConfirmed = computeEffectiveConfirmation(
      participationFee,
      paymentConfirmed,
      paymentExempt,
      {
        profilePresentationStatus: needsProfilePresentation
          ? 'pending'
          : undefined,
      }
    );

    const registration = new Parse.Object(CLASS);
    registration.set('event', EventPointer.createWithoutData(payload.eventId));
    registration.set('user', user);
    registration.set('role', payload.role);
    registration.set('apelido', apelido);
    registration.set('committed', true);
    registration.set('membershipType', payload.membershipType);
    registration.set('attendance', 'pending');
    registration.set('paymentConfirmed', paymentConfirmed);
    registration.set('paymentExempt', paymentExempt);
    registration.set('isEffectivelyConfirmed', isEffectivelyConfirmed);
    if (needsProfilePresentation) {
      registration.set('profilePresentationStatus', 'pending');
    }
    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) {
      registration.set('avatarUrl', avatarUrl);
    }

    if (payload.role === 'athlete') {
      if (!payload.athleteProfileId) {
        throw new Error('Perfil de atleta obrigatorio para esta inscricao.');
      }
      registration.set('athlete', AthletePointer.createWithoutData(payload.athleteProfileId));
    }

    this.applyRegistrationParticipantFields(registration, user, targetEvent, apelido);

    try {
      const saved = await registration.save();
      this.notifyRegistrationsChanged();
      return this.toRegistration(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async registerRefereeFromInvitation(eventId: string, apelido: string): Promise<EventRegistration> {
    return this.registerFromInvitation(eventId, apelido, 'referee', { invited: true });
  }

  async registerFromInvitation(
    eventId: string,
    apelido: string,
    role: ProfileRole,
    options?: { invited?: boolean }
  ): Promise<EventRegistration> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para aceitar o convite.');

    const normalizedApelido = apelido.trim();
    if (normalizedApelido.length < 2) {
      throw new Error('Apelido invalido.');
    }

    const existing = await this.getForEvent(eventId);
    if (existing) {
      throw new Error('Voce ja esta inscrito neste evento.');
    }

    if (await this.isApelidoTakenInEvent(eventId, normalizedApelido)) {
      throw new Error('Apelido ja utilizado neste evento.');
    }

    const targetEvent = await new Parse.Query(EVENT_CLASS).include('pelada').get(eventId);
    const startTime = targetEvent.get('startTime') as Date;
    const endTime = targetEvent.get('endTime') as Date;

    const conflict = await this.findScheduleConflict(eventId, startTime, endTime);
    if (conflict) {
      throw new Error(this.formatScheduleConflictMessage(conflict));
    }

    const registration = new Parse.Object(CLASS);
    registration.set('event', EventPointer.createWithoutData(eventId));
    registration.set('user', user);
    registration.set('role', role);
    registration.set('apelido', normalizedApelido);
    registration.set('committed', true);
    registration.set('membershipType', 'convidado');
    registration.set('attendance', 'pending');
    registration.set('paymentConfirmed', false);
    registration.set('isEffectivelyConfirmed', true);
    if (options?.invited && role === 'referee') {
      registration.set('invitedAsReferee', true);
    }
    if (options?.invited) {
      registration.set('invitedByContract', true);
    }
    if (role === 'athlete') {
      await this.attachAthleteProfile(registration, user);
    }
    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) {
      registration.set('avatarUrl', avatarUrl);
    }

    this.applyRegistrationParticipantFields(registration, user, targetEvent, normalizedApelido);

    try {
      const saved = await registration.save();
      this.notifyRegistrationsChanged();
      return this.toRegistration(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async cancelRegistration(eventId: string): Promise<void> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para cancelar a inscricao.');

    const query = new Parse.Query(CLASS);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.equalTo('user', user);
    const registration = await query.first();

    if (!registration) {
      throw new Error('Voce nao esta inscrito neste evento.');
    }

    try {
      await registration.destroy();
      this.notifyRegistrationsChanged();
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  formatScheduleConflictMessage(conflict: ScheduleConflict): string {
    const start = this.formatDateTime(conflict.startTime);
    const end = this.formatDateTime(conflict.endTime);
    return (
      `Voce ja esta inscrito no evento "${conflict.eventName}" no mesmo horario ` +
      `(${start} - ${end}). Cancele essa inscricao para participar deste evento.`
    );
  }

  private async hasApprovedPeladaParticipation(peladaId: string, userId: string): Promise<boolean> {
    const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(peladaId);
    const eventQuery = new Parse.Query(EVENT_CLASS);
    eventQuery.equalTo('pelada', peladaPtr);
    eventQuery.limit(500);
    const events = await eventQuery.find();
    if (!events.length) return false;

    const regQuery = new Parse.Query(CLASS);
    regQuery.equalTo('user', Parse.User.createWithoutData(userId));
    regQuery.containedIn('event', events);
    regQuery.limit(500);
    const registrations = await regQuery.find();

    return registrations.some((row) => {
      const status = row.get('profilePresentationStatus') as string | undefined;
      if (status === 'approved') return true;
      if (status === 'pending' || status === 'rejected') return false;
      return true;
    });
  }

  formatEffectiveConfirmationLabel(
    registration: EventRegistration,
    participationFee: number
  ): string {
    if (registration.profilePresentationStatus === 'pending') {
      return 'Aguardando aprovacao do administrador da pelada';
    }
    if (registration.profilePresentationStatus === 'rejected') {
      return 'Solicitacao recusada pelo administrador da pelada';
    }
    if (registration.invitedByContract || registration.invitedAsReferee) {
      return registration.isEffectivelyConfirmed
        ? 'Confirmado (contratacao aceita). O pagamento pelo trabalho sera liberado apos o administrador confirmar sua presenca.'
        : 'Aguardando confirmacao da contratacao';
    }
    if (participationFee <= 0) return 'Confirmado';
    if (registration.paymentExempt) return 'Confirmado (isento de pagamento)';
    if (registration.isEffectivelyConfirmed) return 'Confirmado (pagamento validado)';
    if (registration.paymentConfirmed) return 'Pagamento confirmado';
    return 'Aguardando pagamento';
  }

  formatRole(role: ProfileRole): string {
    return PROFILE_ROLE_LABELS[role] ?? role;
  }

  private notifyRegistrationsChanged(): void {
    this.registrationsChanged$.next();
    this.eventService.notifyEventsChanged();
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private toRegistration(obj: Parse.Object): EventRegistration {
    const event = obj.get('event') as Parse.Object;
    const paymentConfirmed = !!obj.get('paymentConfirmed');
    const paymentExempt = !!obj.get('paymentExempt');
    const participationFee = Number((event?.get('participationFee') as number | undefined) ?? 0);
    const profilePresentationStatus = obj.get('profilePresentationStatus') as
      | EventRegistration['profilePresentationStatus']
      | undefined;
    const isEffectivelyConfirmed = computeEffectiveConfirmation(
      participationFee,
      paymentConfirmed,
      paymentExempt,
      {
        invitedByContract: !!obj.get('invitedByContract'),
        invitedAsReferee: !!obj.get('invitedAsReferee'),
        isAnonymous: !!obj.get('isAnonymous'),
        profilePresentationStatus: profilePresentationStatus ?? null,
      }
    );
    const arrivalOrder = obj.get('arrivalOrder') as number | undefined;
    const arrivedAtRaw = obj.get('arrivedAt') as Date | undefined;
    const arrivedAt = arrivedAtRaw ? new Date(arrivedAtRaw) : undefined;

    return {
      objectId: obj.id!,
      eventId: event?.id ?? '',
      role: obj.get('role') as ProfileRole,
      apelido: obj.get('apelido') as string,
      committed: !!obj.get('committed'),
      membershipType: obj.get('membershipType') ?? 'convidado',
      attendance: obj.get('attendance') ?? 'pending',
      paymentConfirmed,
      paymentExempt,
      isEffectivelyConfirmed,
      invitedByContract: !!obj.get('invitedByContract'),
      invitedAsReferee: !!obj.get('invitedAsReferee'),
      profilePresentationStatus,
      arrivalOrder,
      arrivedAt,
    };
  }

  private applyRegistrationParticipantFields(
    registration: Parse.Object,
    user: Parse.User,
    eventObj: Parse.Object,
    apelido: string
  ): void {
    registration.set('participantUserId', user.id!);

    const userApelido = ((user.get('apelido') as string) || '').trim() || apelido.trim();
    const fullName = ((user.get('name') as string) || '').trim();
    registration.set('userApelido', userApelido);
    registration.set('userFullName', fullName);
    registration.set(
      'userDisplayName',
      userApelido || fullName || user.getUsername() || 'Participante'
    );

    const pelada = eventObj.get('pelada') as Parse.Object | undefined;
    if (pelada?.id) {
      registration.set('peladaId', pelada.id);
    }
  }

  private buildPeladaParticipantFromRegistration(row: Parse.Object): PeladaParticipant | null {
    const user = row.get('user') as Parse.User | undefined;
    const userId =
      this.resolveParticipantUserId(row) ||
      user?.id ||
      '';
    if (!userId) {
      return null;
    }

    const role = row.get('role') as ProfileRole;
    const apelido =
      (row.get('apelido') as string) ||
      (row.get('userApelido') as string) ||
      (user?.get('apelido') as string) ||
      '';
    const fullName =
      (row.get('userFullName') as string) || (user?.get('name') as string) || '';
    const userName =
      apelido ||
      (row.get('userDisplayName') as string) ||
      fullName ||
      (user?.get('apelido') as string) ||
      (user?.get('name') as string) ||
      user?.getUsername() ||
      'Participante';
    const registrationAvatarUrl = (row.get('avatarUrl') as string | undefined)?.trim();
    const avatarUrl =
      registrationAvatarUrl || getUserAvatarUrl(user, this.parseFileService) || undefined;
    const birthDate = user?.get('birthDate') as Date | undefined;
    const address = user?.get('address') as PeladaParticipant['address'];

    return {
      userId,
      userName,
      apelido,
      fullName: fullName || undefined,
      roles: [role],
      avatarUrl,
      birthDate,
      address,
      proFootballIdol: (user?.get('proFootballIdol') as string | undefined)?.trim(),
      amateurFootballIdol: (user?.get('amateurFootballIdol') as string | undefined)?.trim(),
    };
  }

  private buildPeladaParticipant(
    user: Parse.User,
    role: ProfileRole,
    apelido: string
  ): PeladaParticipant {
    const displayApelido = apelido || (user.get('apelido') as string) || '';
    const fullName = ((user.get('name') as string) || '').trim();
    const userName =
      displayApelido ||
      fullName ||
      user.getUsername() ||
      'Participante';
    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);

    return {
      userId: user.id!,
      userName,
      apelido: displayApelido,
      fullName: fullName || undefined,
      roles: [role],
      avatarUrl: avatarUrl ?? undefined,
    };
  }

  private toRegistrationListItem(obj: Parse.Object): EventRegistrationListItem {
    const user = obj.get('user') as Parse.User | undefined;
    const athlete = obj.get('athlete') as Parse.Object | undefined;
    const registrationAvatarUrl = (obj.get('avatarUrl') as string | undefined)?.trim();
    const avatarUrl =
      registrationAvatarUrl || getUserAvatarUrl(user, this.parseFileService) || undefined;

    return {
      ...this.toRegistration(obj),
      userId: this.resolveParticipantUserId(obj) || user?.id || '',
      userName:
        (obj.get('userDisplayName') as string) ||
        (obj.get('apelido') as string) ||
        (obj.get('userApelido') as string) ||
        (user?.get('apelido') as string) ||
        (user?.get('name') as string) ||
        user?.getUsername() ||
        'Participante',
      avatarUrl: avatarUrl ?? undefined,
      primaryPosition: athlete?.get('primaryPosition') as string | undefined,
      isAnonymous: !!(obj.get('isAnonymous') as boolean | undefined),
    };
  }

  private async assertNotBannedFromPelada(peladaObj: Parse.Object, userId: string): Promise<void> {
    const banEvents = Number(peladaObj.get('expulsionBanEventCount') ?? 0);
    if (banEvents <= 0) {
      return;
    }

    const sanctionQuery = new Parse.Query('PeladaMemberSanction');
    sanctionQuery.equalTo('pelada', peladaObj);
    sanctionQuery.equalTo('user', Parse.User.createWithoutData(userId));
    sanctionQuery.greaterThan('remainingEventBlocks', 0);
    const sanction = await sanctionQuery.first();
    if (!sanction) {
      return;
    }

    const remaining = Number(sanction.get('remainingEventBlocks') ?? 0);
    throw new Error(
      `Voce esta impedido de participar nesta pelada por ${remaining} evento(s) apos expulsao.`
    );
  }

  private mapCloudRegistrationListItem(raw: unknown): EventRegistrationListItem {
    const row = raw as EventRegistrationListItem & {
      invitedByContract?: boolean;
      invitedAsReferee?: boolean;
    };
    return {
      objectId: String(row.objectId || ''),
      eventId: String(row.eventId || ''),
      userId: String(row.userId || ''),
      userName: String(row.userName || 'Participante'),
      apelido: String(row.apelido || ''),
      role: row.role || 'athlete',
      committed: !!row.committed,
      membershipType: row.membershipType || 'convidado',
      attendance: row.attendance || 'pending',
      paymentConfirmed: !!row.paymentConfirmed,
      paymentExempt: !!row.paymentExempt,
      isEffectivelyConfirmed: !!row.isEffectivelyConfirmed,
      invitedByContract: !!row.invitedByContract,
      invitedAsReferee: !!row.invitedAsReferee,
      profilePresentationStatus: row.profilePresentationStatus,
      arrivalOrder: row.arrivalOrder != null ? Number(row.arrivalOrder) : undefined,
      arrivedAt: row.arrivedAt ? new Date(String(row.arrivedAt)) : undefined,
      avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
      primaryPosition: row.primaryPosition ? String(row.primaryPosition) : undefined,
      isAnonymous: !!row.isAnonymous,
    };
  }

  async countConfirmedAthletesForEvent(eventId: string): Promise<number> {
    const query = new Parse.Query(CLASS);
    query.equalTo('event', EventPointer.createWithoutData(eventId));
    query.equalTo('role', 'athlete');
    query.equalTo('isEffectivelyConfirmed', true);
    return query.count();
  }

  async countConfirmedAthletesForEvents(eventIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!eventIds.length) return counts;
    for (const id of eventIds) counts.set(id, 0);

    const query = new Parse.Query(CLASS);
    query.containedIn(
      'event',
      eventIds.map((id) => EventPointer.createWithoutData(id))
    );
    query.equalTo('role', 'athlete');
    query.equalTo('isEffectivelyConfirmed', true);
    query.select('event');
    query.limit(1000);

    const results = await query.find();
    for (const row of results) {
      const eventId = (row.get('event') as Parse.Object | undefined)?.id;
      if (!eventId) continue;
      counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
    }
    return counts;
  }

  async resolveMaxAthletesForEvent(event: PeladaEvent): Promise<number> {
    const eventMax = Number(event.maxAthletesPerEvent ?? 0);
    if (eventMax > 0) return eventMax;
    if (!event.peladaId) return 0;
    const pelada = await new Parse.Query('Pelada').get(event.peladaId);
    return Number(pelada.get('maxAthletesPerEvent') ?? 0);
  }

  async isAthleteRegistrationFullForEvent(event: PeladaEvent): Promise<boolean> {
    const max = await this.resolveMaxAthletesForEvent(event);
    if (max <= 0) return false;
    const count = await this.countConfirmedAthletesForEvent(event.objectId);
    return count >= max;
  }
}

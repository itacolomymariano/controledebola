import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import {
  Address,
  isSameAddressLocation,
  normalizeAddress,
  normalizeBrazilUf,
} from '../models/address.model';
import {
  computeReadOnlyAt,
  CreateEventPayload,
  EVENT_TYPE_LABELS,
  EventLocationConflict,
  EventSearchFilters,
  EventType,
  getRegistrationStatus,
  getRegistrationStatusLabel,
  isEventReadOnly,
  hasPixKey,
  isSameLocationComplement,
  PeladaEvent,
  supportsArrivalOrder,
  UpdateEventAdminPayload,
} from '../models/event.model';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const EVENT_CLASS = 'Event';

interface SortContext {
  userCity?: string;
  participatedEventIds: Set<string>;
  memberEventIds: Set<string>;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly eventsChanged$ = new Subject<void>();

  readonly onEventsChanged = this.eventsChanged$.asObservable();

  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  notifyEventsChanged(): void {
    this.eventsChanged$.next();
  }

  async listForPelada(
    peladaId: string,
    sortContext?: Partial<SortContext>
  ): Promise<PeladaEvent[]> {
    const upcoming = await this.fetchEvents({ upcomingOnly: true, peladaId });
    const participatedIds = sortContext?.participatedEventIds ?? new Set<string>();
    const upcomingIds = new Set(upcoming.map((event) => event.objectId));

    let pastParticipated: PeladaEvent[] = [];
    if (participatedIds.size > 0) {
      const pastQuery = new Parse.Query(EVENT_CLASS);
      pastQuery.containedIn('objectId', Array.from(participatedIds));
      pastQuery.equalTo('pelada', Parse.Object.extend('Pelada').createWithoutData(peladaId));
      pastQuery.lessThan('endTime', new Date());
      pastQuery.include('admin');
      pastQuery.include('pelada');
      pastQuery.descending('endTime');
      pastQuery.limit(50);
      const results = await pastQuery.find();
      pastParticipated = results
        .map((obj) => this.toPeladaEvent(obj))
        .filter((event) => !upcomingIds.has(event.objectId));
    }

    return this.sortEvents([...upcoming, ...pastParticipated], sortContext);
  }

  async listForFeed(sortContext?: Partial<SortContext>): Promise<PeladaEvent[]> {
    const upcoming = await this.fetchEvents({ upcomingOnly: true });
    const participatedIds = sortContext?.participatedEventIds ?? new Set<string>();
    const upcomingIds = new Set(upcoming.map((event) => event.objectId));

    let pastParticipated: PeladaEvent[] = [];
    if (participatedIds.size > 0) {
      const pastQuery = new Parse.Query(EVENT_CLASS);
      pastQuery.containedIn('objectId', Array.from(participatedIds));
      pastQuery.lessThan('endTime', new Date());
      pastQuery.include('admin');
      pastQuery.descending('endTime');
      pastQuery.limit(50);
      const results = await pastQuery.find();
      pastParticipated = results
        .map((obj) => this.toPeladaEvent(obj))
        .filter((event) => !upcomingIds.has(event.objectId));
    }

    return this.sortEvents([...upcoming, ...pastParticipated], sortContext);
  }

  async search(filters: EventSearchFilters): Promise<PeladaEvent[]> {
    const query = new Parse.Query(EVENT_CLASS);
    query.include('admin');

    if (filters.type) {
      query.equalTo('type', filters.type);
    }

    if (filters.city?.trim()) {
      query.matches('address.city', filters.city.trim(), 'i');
    }

    if (filters.query?.trim()) {
      query.matches('name', filters.query.trim(), 'i');
    }

    query.ascending('startTime');
    query.limit(50);
    const results = await query.find();
    return results.map((obj) => this.toPeladaEvent(obj));
  }

  async getById(eventId: string): Promise<PeladaEvent | null> {
    const query = new Parse.Query(EVENT_CLASS);
    query.include('admin');
    query.include('pelada');
    const result = await query.get(eventId);
    if (!result) return null;
    const event = this.toPeladaEvent(result);
    await this.enrichAdminProfile(event);
    return event;
  }

  async findLocationScheduleConflict(
    startTime: Date,
    endTime: Date,
    address: Address,
    locationComplement: string,
    excludeEventId?: string
  ): Promise<EventLocationConflict | null> {
    const query = new Parse.Query(EVENT_CLASS);
    query.lessThan('startTime', endTime);
    query.greaterThan('endTime', startTime);
    query.limit(100);
    const results = await query.find();

    for (const obj of results) {
      if (excludeEventId && obj.id === excludeEventId) continue;

      const otherAddress = (obj.get('address') as Address) ?? emptyAddressFallback();
      if (!isSameAddressLocation(address, otherAddress)) continue;

      const otherComplement = (obj.get('locationComplement') as string) ?? '';
      if (!isSameLocationComplement(locationComplement, otherComplement)) continue;

      return {
        eventId: obj.id!,
        eventName: (obj.get('name') as string) || 'Outro evento',
        startTime: obj.get('startTime') as Date,
        endTime: obj.get('endTime') as Date,
        locationComplement: otherComplement,
      };
    }

    return null;
  }

  formatLocationConflictMessage(conflict: EventLocationConflict): string {
    const start = this.formatDateTime(conflict.startTime);
    const end = this.formatDateTime(conflict.endTime);
    const complement = conflict.locationComplement.trim();
    const complementLabel = complement ? `, complemento "${complement}"` : '';
    return (
      `Ja existe o evento "${conflict.eventName}" no mesmo local${complementLabel} e horario ` +
      `(${start} - ${end}). Escolha outra data, horario, local ou complemento.`
    );
  }

  async create(payload: CreateEventPayload): Promise<PeladaEvent> {
    const user = Parse.User.current();
    if (!user) {
      throw new Error('Faca login para criar um evento.');
    }

    const locationComplement = payload.locationComplement?.trim() ?? '';

    const conflict = await this.findLocationScheduleConflict(
      payload.startTime,
      payload.endTime,
      payload.address,
      locationComplement
    );
    if (conflict) {
      throw new Error(this.formatLocationConflictMessage(conflict));
    }

    const participationFee = Math.max(0, payload.participationFee ?? 0);
    const pixKey1 = payload.pixKey1?.trim() ?? '';
    const pixKey2 = payload.pixKey2?.trim() ?? '';
    const pixKey3 = payload.pixKey3?.trim() ?? '';

    if (participationFee > 0 && !hasPixKey(pixKey1, pixKey2, pixKey3)) {
      throw new Error('Informe ao menos uma chave PIX quando houver valor de participacao.');
    }

    const registrationOpensAt = payload.registrationOpensAt ?? new Date();
    const registrationClosesAt = payload.registrationClosesAt ?? payload.startTime;
    const useArrivalOrderForTeams =
      supportsArrivalOrder(payload.type) && !!payload.useArrivalOrderForTeams;

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(payload.peladaId);
    const peladaAdmin = peladaObj.get('admin') as Parse.User | undefined;
    if (peladaAdmin?.id !== user.id) {
      throw new Error('Apenas o administrador da pelada pode criar eventos nela.');
    }

    const event = new Parse.Object(EVENT_CLASS);
    event.set('pelada', peladaObj);
    event.set('name', payload.name.trim());
    event.set('type', payload.type);
    event.set('startTime', payload.startTime);
    event.set('endTime', payload.endTime);
    event.set('address', normalizeAddress(payload.address));
    event.set('locationComplement', locationComplement);
    event.set('admin', user);
    this.applyAdminDisplayFields(event, user);
    event.set('readOnlyAt', computeReadOnlyAt(payload.endTime));
    event.set('registrationOpensAt', registrationOpensAt);
    event.set('registrationClosesAt', registrationClosesAt);
    event.set('useArrivalOrderForTeams', useArrivalOrderForTeams);
    event.set('participationFee', participationFee);
    event.set('pixKey1', pixKey1);
    event.set('pixKey2', pixKey2);
    event.set('pixKey3', pixKey3);

    if (payload.gateTicketControlEnabled !== undefined) {
      event.set('gateTicketControlEnabled', !!payload.gateTicketControlEnabled);
    }

    if (payload.type === 'team_match') {
      const homeTeamName = payload.homeTeamName?.trim();
      const awayTeamName = payload.awayTeamName?.trim();
      if (homeTeamName) event.set('homeTeamName', homeTeamName);
      if (awayTeamName) event.set('awayTeamName', awayTeamName);
    }

    const saved = await event.save();
    await saved.fetchWithInclude('admin');
    const created = this.toPeladaEvent(saved);
    this.notifyEventsChanged();
    return created;
  }

  async updateAdminSettings(eventId: string, payload: UpdateEventAdminPayload): Promise<PeladaEvent> {
    const user = Parse.User.current();
    if (!user) {
      throw new Error('Faca login para atualizar o evento.');
    }

    const query = new Parse.Query(EVENT_CLASS);
    query.include('admin');
    const eventObj = await query.get(eventId);
    const admin = eventObj.get('admin') as Parse.User | undefined;

    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode alterar estas configuracoes.');
    }

    if (payload.registrationClosesAt <= payload.registrationOpensAt) {
      throw new Error('O encerramento das inscricoes deve ser apos a abertura.');
    }

    const type = eventObj.get('type') as EventType;
    const useArrivalOrderForTeams =
      supportsArrivalOrder(type) && payload.useArrivalOrderForTeams;

    eventObj.set('registrationOpensAt', payload.registrationOpensAt);
    eventObj.set('registrationClosesAt', payload.registrationClosesAt);
    eventObj.set('useArrivalOrderForTeams', useArrivalOrderForTeams);
    if (payload.isFinished !== undefined) {
      eventObj.set('isFinished', payload.isFinished);
    }

    if (payload.votingOpensAt === null) {
      eventObj.unset('votingOpensAt');
      eventObj.unset('votingClosesAt');
    } else if (payload.votingOpensAt && payload.votingClosesAt) {
      if (payload.votingClosesAt <= payload.votingOpensAt) {
        throw new Error('O encerramento da votacao deve ser apos a abertura.');
      }
      eventObj.set('votingOpensAt', payload.votingOpensAt);
      eventObj.set('votingClosesAt', payload.votingClosesAt);
    }

    this.applyOptionalDateRange(eventObj, 'sumulaOpensAt', 'sumulaClosesAt', payload.sumulaOpensAt, payload.sumulaClosesAt, 'sumula');
    this.applyOptionalDateRange(
      eventObj,
      'scoutApontamentoOpensAt',
      'scoutApontamentoClosesAt',
      payload.scoutApontamentoOpensAt,
      payload.scoutApontamentoClosesAt,
      'apontamento scout'
    );

    if (payload.gateTicketControlEnabled !== undefined) {
      eventObj.set('gateTicketControlEnabled', !!payload.gateTicketControlEnabled);
    }

    if (payload.maxAthletesPerEvent !== undefined) {
      eventObj.set('maxAthletesPerEvent', Math.max(0, Number(payload.maxAthletesPerEvent)));
    }

    if (payload.participationFee !== undefined) {
      const participationFee = Math.max(0, Number(payload.participationFee));
      const pixKey1 = payload.pixKey1?.trim() ?? '';
      const pixKey2 = payload.pixKey2?.trim() ?? '';
      const pixKey3 = payload.pixKey3?.trim() ?? '';

      if (participationFee > 0 && !hasPixKey(pixKey1, pixKey2, pixKey3)) {
        throw new Error('Informe ao menos uma chave PIX quando o valor da participacao for maior que zero.');
      }

      eventObj.set('participationFee', participationFee);
      eventObj.set('pixKey1', pixKey1);
      eventObj.set('pixKey2', pixKey2);
      eventObj.set('pixKey3', pixKey3);
    }

    const saved = await eventObj.save();
    await saved.fetchWithInclude('admin');
    const updated = this.toPeladaEvent(saved);
    this.notifyEventsChanged();
    return updated;
  }

  isCurrentUserAdmin(event: PeladaEvent): boolean {
    const user = Parse.User.current();
    return !!user && user.id === event.adminId;
  }

  areRegistrationsOpen(event: PeladaEvent, now = new Date()): boolean {
    return getRegistrationStatus(event.registrationOpensAt, event.registrationClosesAt, now) === 'open';
  }

  registrationStatusLabel(event: PeladaEvent, now = new Date()): string {
    return getRegistrationStatusLabel(
      getRegistrationStatus(event.registrationOpensAt, event.registrationClosesAt, now)
    );
  }

  formatType(type: EventType): string {
    return EVENT_TYPE_LABELS[type] ?? type;
  }

  formatParticipationFee(fee: number): string {
    if (fee <= 0) return 'Gratuito';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(fee);
  }

  formatAddress(address: Address): string {
    const parts = [
      address.street,
      address.neighborhood,
      address.city,
      normalizeBrazilUf(address.state),
    ];
    return parts.filter(Boolean).join(', ');
  }

  private async fetchEvents(options: { upcomingOnly: boolean; peladaId?: string }): Promise<PeladaEvent[]> {
    const query = new Parse.Query(EVENT_CLASS);
    query.include('admin');
    query.include('pelada');
    if (options.peladaId) {
      query.equalTo('pelada', Parse.Object.extend('Pelada').createWithoutData(options.peladaId));
    }
    if (options.upcomingOnly) {
      query.greaterThanOrEqualTo('endTime', new Date());
    }
    query.ascending('startTime');
    query.limit(100);
    const results = await query.find();
    return results.map((obj) => this.toPeladaEvent(obj));
  }

  private sortEvents(events: PeladaEvent[], sortContext?: Partial<SortContext>): PeladaEvent[] {
    const userCity = sortContext?.userCity?.toLowerCase().trim();
    const participated = sortContext?.participatedEventIds ?? new Set<string>();
    const members = sortContext?.memberEventIds ?? new Set<string>();
    const now = Date.now();

    const score = (event: PeladaEvent): number => {
      const isPast = event.endTime.getTime() < now;
      let value = isPast ? -1000 : 0;
      if (members.has(event.objectId)) value += 300;
      else if (participated.has(event.objectId)) value += 200;
      if (userCity && event.address.city?.toLowerCase().trim() === userCity) value += 100;
      return value;
    };

    return [...events].sort((a, b) => {
      const aPast = a.endTime.getTime() < now;
      const bPast = b.endTime.getTime() < now;
      if (aPast !== bPast) return aPast ? 1 : -1;

      const diff = score(b) - score(a);
      if (diff !== 0) return diff;

      if (aPast && bPast) {
        return b.endTime.getTime() - a.endTime.getTime();
      }
      return a.startTime.getTime() - b.startTime.getTime();
    });
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private async enrichAdminProfile(event: PeladaEvent): Promise<void> {
    if (!event.adminId) return;

    const currentUser = Parse.User.current();
    if (currentUser?.id === event.adminId) {
      try {
        await currentUser.fetch();
        const apelido = (currentUser.get('apelido') as string) || '';
        event.adminApelido = apelido || event.adminApelido;
        event.adminName =
          apelido ||
          (currentUser.get('name') as string) ||
          currentUser.getUsername() ||
          event.adminName;
        event.adminAvatarUrl =
          getUserAvatarUrl(currentUser, this.parseFileService) ?? event.adminAvatarUrl;
        await this.persistAdminDisplayFields(event.objectId, currentUser);
      } catch {
        // Mantem dados ja carregados do evento.
      }
      return;
    }

    if (event.adminAvatarUrl && event.adminApelido && event.adminName !== 'Administrador') {
      return;
    }

    try {
      const admin = await new Parse.Query(Parse.User).get(event.adminId);
      event.adminApelido = (admin.get('apelido') as string) || event.adminApelido;
      event.adminName =
        (admin.get('apelido') as string) ||
        (admin.get('name') as string) ||
        admin.getUsername() ||
        event.adminName;
      event.adminAvatarUrl = getUserAvatarUrl(admin, this.parseFileService) ?? event.adminAvatarUrl;
    } catch {
      // Mantem dados denormalizados do evento quando a CLP bloqueia leitura do admin.
    }
  }

  private applyAdminDisplayFields(eventObj: Parse.Object, user: Parse.User): void {
    const apelido = (user.get('apelido') as string) || '';
    const name = apelido || (user.get('name') as string) || user.getUsername() || 'Administrador';
    eventObj.set('adminApelido', apelido);
    eventObj.set('adminName', name);
    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) {
      eventObj.set('adminAvatarUrl', avatarUrl);
    }
  }

  private async persistAdminDisplayFields(eventId: string, user: Parse.User): Promise<void> {
    try {
      const eventObj = await new Parse.Query(EVENT_CLASS).get(eventId);
      this.applyAdminDisplayFields(eventObj, user);
      await eventObj.save();
    } catch {
      // Ignora falha ao persistir campos de exibicao do admin.
    }
  }

  private toPeladaEvent(obj: Parse.Object): PeladaEvent {
    const admin = obj.get('admin') as Parse.User | undefined;
    const pelada = obj.get('pelada') as Parse.Object | undefined;
    const address = normalizeAddress(
      (obj.get('address') as Address) ?? {
        state: '',
        city: '',
        neighborhood: '',
        zipCode: '',
        street: '',
      }
    );
    const adminApelido =
      (obj.get('adminApelido') as string | undefined)?.trim() ||
      (admin?.get('apelido') as string) ||
      '';
    const adminName =
      (obj.get('adminName') as string | undefined)?.trim() ||
      adminApelido ||
      (admin?.get('name') as string) ||
      admin?.getUsername() ||
      'Administrador';
    const adminAvatarUrl =
      (obj.get('adminAvatarUrl') as string | undefined)?.trim() ||
      getUserAvatarUrl(admin, this.parseFileService) ||
      undefined;
    const startTime = obj.get('startTime') as Date;
    const endTime = obj.get('endTime') as Date;
    const readOnlyAt = (obj.get('readOnlyAt') as Date) ?? computeReadOnlyAt(endTime);
    const registrationOpensAt = (obj.get('registrationOpensAt') as Date) ?? new Date(0);
    const registrationClosesAt = (obj.get('registrationClosesAt') as Date) ?? startTime;
    const type = obj.get('type') as EventType;

    return {
      objectId: obj.id!,
      peladaId: pelada?.id,
      peladaName: pelada?.get('name') as string | undefined,
      name: obj.get('name') as string,
      type,
      startTime,
      endTime,
      address,
      locationComplement: (obj.get('locationComplement') as string) ?? '',
      adminId: admin?.id ?? '',
      adminName,
      adminApelido: adminApelido || undefined,
      adminAvatarUrl: adminAvatarUrl || undefined,
      readOnlyAt,
      isReadOnly: isEventReadOnly(endTime),
      registrationOpensAt,
      registrationClosesAt,
      useArrivalOrderForTeams: supportsArrivalOrder(type) && !!obj.get('useArrivalOrderForTeams'),
      participationFee: Number(obj.get('participationFee') ?? 0),
      pixKey1: (obj.get('pixKey1') as string) ?? '',
      pixKey2: (obj.get('pixKey2') as string) ?? '',
      pixKey3: (obj.get('pixKey3') as string) ?? '',
      homeTeamName: (obj.get('homeTeamName') as string) || undefined,
      awayTeamName: (obj.get('awayTeamName') as string) || undefined,
      isFinished: !!obj.get('isFinished'),
      votingOpensAt: obj.get('votingOpensAt') as Date | undefined,
      votingClosesAt: obj.get('votingClosesAt') as Date | undefined,
      sumulaOpensAt: obj.get('sumulaOpensAt') as Date | undefined,
      sumulaClosesAt: obj.get('sumulaClosesAt') as Date | undefined,
      scoutApontamentoOpensAt: obj.get('scoutApontamentoOpensAt') as Date | undefined,
      scoutApontamentoClosesAt: obj.get('scoutApontamentoClosesAt') as Date | undefined,
      gateTicketControlEnabled: !!obj.get('gateTicketControlEnabled'),
      maxAthletesPerEvent: Number(obj.get('maxAthletesPerEvent') ?? 0) || undefined,
      allowTeamSplitAfterEventEnd: pelada ? !!pelada.get('allowTeamSplitAfterEventEnd') : undefined,
    };
  }

  private applyOptionalDateRange(
    eventObj: Parse.Object,
    openField: string,
    closeField: string,
    opensAt: Date | null | undefined,
    closesAt: Date | null | undefined,
    label: string
  ): void {
    if (opensAt === null && closesAt === null) {
      eventObj.unset(openField);
      eventObj.unset(closeField);
      return;
    }
    if (opensAt === undefined && closesAt === undefined) {
      return;
    }
    if (!opensAt || !closesAt) {
      throw new Error(`Informe abertura e encerramento do periodo de ${label}, ou deixe ambos em branco.`);
    }
    if (closesAt <= opensAt) {
      throw new Error(`O encerramento do periodo de ${label} deve ser apos a abertura.`);
    }
    eventObj.set(openField, opensAt);
    eventObj.set(closeField, closesAt);
  }
}

function emptyAddressFallback(): Address {
  return {
    street: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
  };
}

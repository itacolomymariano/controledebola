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
  CreateTeamMatchPayload,
  EVENT_TYPE_LABELS,
  TeamMatchListItem,
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
import { locationProximityScore } from '../utils/location-proximity.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const EVENT_CLASS = 'Event';
const TEAM_CLASS = 'AmateurTeam';

export interface TeamMatchRescheduleProposal {
  eventId: string;
  eventName: string;
  homeTeamName: string;
  awayTeamName: string;
  currentStartTime: Date | null;
  proposedStartTime: Date | null;
  proposedEndTime: Date | null;
  reason: string;
  requestedByUserId: string;
  requestedAt: Date | null;
  status: string;
}

function includeEventRelations(query: Parse.Query): void {
  query.include('admin');
  query.include('pelada');
  query.include('homeTeam');
  query.include('awayTeam');
}

function teamShieldUrlFromParse(team: Parse.Object | undefined): string | undefined {
  if (!team) return undefined;
  const shield = team.get('shieldImage') as Parse.File | undefined;
  if (!shield?.url) return undefined;
  return shield.url();
}

interface SortContext {
  userCity?: string;
  participatedEventIds: Set<string>;
  memberEventIds: Set<string>;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly eventsChanged$ = new Subject<void>();
  private teamMatchRepairCheckedForUserId: string | null = null;

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

  /** Todos os eventos da pelada (abertos, fechados e encerrados). A home usa listForFeed. */
  async listForPelada(
    peladaId: string,
    sortContext?: Partial<SortContext>
  ): Promise<PeladaEvent[]> {
    const all = await this.fetchEvents({ upcomingOnly: false, peladaId });
    // Confrontos nao devem listar dentro de pelada (mesmo se pointer residual existir).
    const withoutTeamMatches = all.filter((event) => event.type !== 'team_match');
    return this.sortEvents(withoutTeamMatches, sortContext);
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
      includeEventRelations(pastQuery);
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
    const queryText = filters.query?.trim() || '';
    const cityFilter = filters.city?.trim() || '';
    const neighborhoodFilter = filters.neighborhood?.trim() || '';
    const userAddress = (Parse.User.current()?.get('address') as Address) || undefined;

    // Confrontos: busca mais ampla (nome + times) via feed + proximidade.
    if (filters.type === 'team_match') {
      return this.searchTeamMatchesFromFeed(
        queryText,
        cityFilter,
        userAddress,
        neighborhoodFilter
      );
    }

    const events = await this.fetchEventsMatchingNameOrPelada(
      filters,
      queryText,
      cityFilter,
      neighborhoodFilter
    );

    // Sem filtro de tipo: inclui confrontos cujo nome, time ou pelada (se o feed trouxer) bate.
    if (!filters.type && (queryText || neighborhoodFilter)) {
      try {
        const teamMatches = await this.searchTeamMatchesFromFeed(
          queryText,
          cityFilter,
          userAddress,
          neighborhoodFilter
        );
        const seen = new Set(events.map((event) => event.objectId));
        for (const match of teamMatches) {
          if (!seen.has(match.objectId)) {
            events.push(match);
            seen.add(match.objectId);
          }
        }
      } catch {
        /* ignora merge */
      }
    }

    return this.sortEventsByProximity(events, userAddress).slice(0, 50);
  }

  private constrainEventSearch(
    query: Parse.Query,
    filters: EventSearchFilters,
    cityFilter: string,
    neighborhoodFilter: string
  ): void {
    if (filters.type) {
      query.equalTo('type', filters.type);
    }
    if (cityFilter) {
      query.matches('address.city', cityFilter, 'i');
    }
    if (neighborhoodFilter) {
      query.matches('address.neighborhood', neighborhoodFilter, 'i');
    }
  }

  /** Nome do evento ou nome da pelada dona (pointer `pelada`). */
  private async fetchEventsMatchingNameOrPelada(
    filters: EventSearchFilters,
    queryText: string,
    cityFilter: string,
    neighborhoodFilter: string
  ): Promise<PeladaEvent[]> {
    let query: Parse.Query;
    if (queryText) {
      const byName = new Parse.Query(EVENT_CLASS);
      this.constrainEventSearch(byName, filters, cityFilter, neighborhoodFilter);
      byName.matches('name', queryText, 'i');
      includeEventRelations(byName);

      const peladaQuery = new Parse.Query('Pelada');
      peladaQuery.matches('name', queryText, 'i');
      const byPelada = new Parse.Query(EVENT_CLASS);
      this.constrainEventSearch(byPelada, filters, cityFilter, neighborhoodFilter);
      byPelada.matchesQuery('pelada', peladaQuery);
      includeEventRelations(byPelada);

      query = Parse.Query.or(byName, byPelada);
    } else {
      query = new Parse.Query(EVENT_CLASS);
      this.constrainEventSearch(query, filters, cityFilter, neighborhoodFilter);
    }

    includeEventRelations(query);
    query.ascending('startTime');
    query.limit(100);
    let results: Parse.Object[];
    try {
      results = await query.find();
    } catch (error) {
      if (!queryText) throw error;
      const fallback = new Parse.Query(EVENT_CLASS);
      this.constrainEventSearch(fallback, filters, cityFilter, neighborhoodFilter);
      fallback.matches('name', queryText, 'i');
      includeEventRelations(fallback);
      fallback.ascending('startTime');
      fallback.limit(100);
      results = await fallback.find();
    }

    const seen = new Set<string>();
    const events: PeladaEvent[] = [];
    for (const obj of results) {
      const event = this.toPeladaEvent(obj);
      if (!event.objectId || seen.has(event.objectId)) continue;
      seen.add(event.objectId);
      events.push(event);
    }
    return events;
  }

  private async searchTeamMatchesFromFeed(
    queryText: string,
    cityFilter: string,
    userAddress?: Address,
    neighborhoodFilter = ''
  ): Promise<PeladaEvent[]> {
    const rows = await Parse.Cloud.run('listTeamMatchesForFeed');
    if (!Array.isArray(rows)) return [];
    let items = rows.map((row) => this.teamMatchRowToPeladaEvent(row as Record<string, unknown>));
    if (queryText) {
      const q = queryText.toLowerCase();
      items = items.filter((event) => {
        const hay = [
          event.name,
          event.peladaName,
          event.homeTeamName,
          event.awayTeamName,
          event.address?.city,
          event.address?.neighborhood,
          event.locationComplement,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (cityFilter) {
      const city = cityFilter.toLowerCase();
      items = items.filter((event) => event.address?.city?.toLowerCase().trim() === city);
    }
    if (neighborhoodFilter) {
      const neighborhood = neighborhoodFilter.toLowerCase();
      items = items.filter((event) =>
        (event.address?.neighborhood || '').toLowerCase().includes(neighborhood)
      );
    }
    return this.sortEventsByProximity(items, userAddress).slice(0, 50);
  }

  async listMyTeamMatches(): Promise<TeamMatchListItem[]> {
    const rows = await Parse.Cloud.run('listMyTeamMatches');
    return Array.isArray(rows) ? rows.map((row) => this.toTeamMatchListItem(row)) : [];
  }

  /** Feed publico de confrontos (todos os usuarios), ordenado por proximidade. */
  async listTeamMatchesForFeed(): Promise<TeamMatchListItem[]> {
    const userId = Parse.User.current()?.id || '';
    if (userId && this.teamMatchRepairCheckedForUserId !== userId) {
      try {
        await Parse.Cloud.run('repairTeamMatchOwnership');
      } catch {
        /* reparo best-effort */
      }
      this.teamMatchRepairCheckedForUserId = userId;
    }
    const rows = await Parse.Cloud.run('listTeamMatchesForFeed');
    const items = Array.isArray(rows) ? rows.map((row) => this.toTeamMatchListItem(row)) : [];
    const userAddress = (Parse.User.current()?.get('address') as Address) || undefined;
    const userCity = userAddress?.city?.toLowerCase().trim();
    const now = Date.now();

    return [...items]
      .map((match) => ({
        ...match,
        nearby: !!userCity && match.address.city?.toLowerCase().trim() === userCity,
      }))
      .sort((a, b) => {
        const aPast = a.endTime.getTime() < now;
        const bPast = b.endTime.getTime() < now;
        if (aPast !== bPast) return aPast ? 1 : -1;

        const scoreDiff =
          locationProximityScore(userAddress, b.address) -
          locationProximityScore(userAddress, a.address);
        if (scoreDiff !== 0) return scoreDiff;

        if (aPast && bPast) {
          return b.endTime.getTime() - a.endTime.getTime();
        }
        return a.startTime.getTime() - b.startTime.getTime();
      });
  }

  async listTeamMatchInboxNotices(): Promise<TeamMatchListItem[]> {
    const rows = await Parse.Cloud.run('listTeamMatchInboxNotices');
    return Array.isArray(rows) ? rows.map((row) => this.toTeamMatchListItem(row)) : [];
  }

  async getById(eventId: string): Promise<PeladaEvent | null> {
    const query = new Parse.Query(EVENT_CLASS);
    includeEventRelations(query);
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

  async create(payload: CreateEventPayload): Promise<{
    event: PeladaEvent;
    push: { skipped?: string | null; audience?: number; devicesMatched?: number } | null;
  }> {
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
      this.applyTeamMatchFields(event, payload);
    }

    const saved = await event.save();
    await saved.fetchWithInclude(['admin', 'homeTeam', 'awayTeam']);
    const created = this.toPeladaEvent(saved);
    let push: { skipped?: string | null; audience?: number; devicesMatched?: number } | null = null;
    try {
      push = await Parse.Cloud.run('notifyNewPeladaEventCreated', { eventId: created.objectId });
    } catch (error: unknown) {
      console.warn('notifyNewPeladaEventCreated failed', error);
    }
    this.notifyEventsChanged();
    return { event: created, push };
  }

  async createTeamMatch(payload: CreateTeamMatchPayload): Promise<{
    eventId: string;
    returnEventId?: string;
    invitedAthletes: number;
    push: { audience?: number; devicesMatched?: number } | null;
  }> {
    const result = (await Parse.Cloud.run('createTeamMatch', {
      name: payload.name,
      homeTeamId: payload.homeTeamId,
      awayTeamId: payload.awayTeamId,
      challengeId: payload.challengeId,
      challengeConditions: payload.challengeConditions?.trim() || '',
      startTime: payload.startTime.toISOString(),
      endTime: payload.endTime.toISOString(),
      address: normalizeAddress(payload.address),
      locationComplement: payload.locationComplement?.trim() || '',
      returnLeg: !!payload.returnLeg,
      returnStartTime: payload.returnStartTime?.toISOString(),
      returnEndTime: payload.returnEndTime?.toISOString(),
      returnAddress: payload.returnAddress ? normalizeAddress(payload.returnAddress) : undefined,
      returnLocationComplement: payload.returnLocationComplement?.trim() || '',
      athleteUserIds: payload.athleteUserIds || [],
      athleteInvites: payload.athleteInvites || [],
      offeredAmount: payload.offeredAmount ?? 0,
      responseDeadline: payload.responseDeadline?.toISOString(),
    })) as {
      event?: { objectId?: string };
      returnEvent?: { objectId?: string } | null;
      invitedAthletes?: number;
      push?: { audience?: number; devicesMatched?: number };
    };
    this.notifyEventsChanged();
    return {
      eventId: String(result?.event?.objectId || ''),
      returnEventId: result?.returnEvent?.objectId ? String(result.returnEvent.objectId) : undefined,
      invitedAthletes: Number(result?.invitedAthletes || 0),
      push: result?.push || null,
    };
  }

  canManageTeamMatchSchedule(event: PeladaEvent, myTeamIds: string[] = []): boolean {
    if (event.type !== 'team_match' || event.isFinished) return false;
    if (new Date() >= event.startTime) return false;
    if (this.isCurrentUserAdmin(event)) return true;
    const ids = myTeamIds.map((id) => id.trim()).filter(Boolean);
    if (!ids.length) return false;
    return (
      (!!event.homeTeamId && ids.includes(event.homeTeamId)) ||
      (!!event.awayTeamId && ids.includes(event.awayTeamId))
    );
  }

  async cancelTeamMatch(eventId: string, reason: string): Promise<void> {
    await Parse.Cloud.run('cancelTeamMatch', { eventId, reason: reason.trim() });
    this.notifyEventsChanged();
  }

  async rescheduleTeamMatch(
    eventId: string,
    payload: { startTime: Date; endTime: Date; reason: string }
  ): Promise<{ pending: boolean }> {
    const result = (await Parse.Cloud.run('rescheduleTeamMatch', {
      eventId,
      startTime: payload.startTime.toISOString(),
      endTime: payload.endTime.toISOString(),
      reason: payload.reason.trim(),
    })) as { pending?: boolean };
    this.notifyEventsChanged();
    return { pending: !!result?.pending };
  }

  async respondTeamMatchReschedule(
    eventId: string,
    decision: 'accepted' | 'declined',
    declineReason = ''
  ): Promise<void> {
    await Parse.Cloud.run('respondTeamMatchReschedule', {
      eventId,
      decision,
      declineReason: declineReason.trim(),
    });
    this.notifyEventsChanged();
  }

  async listPendingTeamMatchReschedules(): Promise<TeamMatchRescheduleProposal[]> {
    const rows = await Parse.Cloud.run('listPendingTeamMatchReschedules');
    return Array.isArray(rows) ? rows.map((row) => this.toRescheduleProposal(row)) : [];
  }

  async getTeamMatchPendingReschedule(
    eventId: string
  ): Promise<TeamMatchRescheduleProposal | null> {
    const row = await Parse.Cloud.run('getTeamMatchPendingReschedule', { eventId });
    return row ? this.toRescheduleProposal(row) : null;
  }

  private toRescheduleProposal(row: Record<string, unknown>): TeamMatchRescheduleProposal {
    return {
      eventId: String(row['eventId'] || ''),
      eventName: String(row['eventName'] || ''),
      homeTeamName: String(row['homeTeamName'] || ''),
      awayTeamName: String(row['awayTeamName'] || ''),
      currentStartTime: row['currentStartTime']
        ? new Date(String(row['currentStartTime']))
        : null,
      proposedStartTime: row['proposedStartTime']
        ? new Date(String(row['proposedStartTime']))
        : null,
      proposedEndTime: row['proposedEndTime']
        ? new Date(String(row['proposedEndTime']))
        : null,
      reason: String(row['reason'] || ''),
      requestedByUserId: String(row['requestedByUserId'] || ''),
      requestedAt: row['requestedAt'] ? new Date(String(row['requestedAt'])) : null,
      status: String(row['status'] || 'pending'),
    };
  }

  async setTeamMatchAcceptsUninvitedAthletes(
    eventId: string,
    teamSide: 'home' | 'away',
    accepts: boolean
  ): Promise<{
    homeAcceptsUninvitedAthletes: boolean;
    awayAcceptsUninvitedAthletes: boolean;
  }> {
    const result = (await Parse.Cloud.run('setTeamMatchAcceptsUninvitedAthletes', {
      eventId,
      teamSide,
      accepts,
    })) as {
      homeAcceptsUninvitedAthletes?: boolean;
      awayAcceptsUninvitedAthletes?: boolean;
    };
    this.notifyEventsChanged();
    return {
      homeAcceptsUninvitedAthletes: !!result.homeAcceptsUninvitedAthletes,
      awayAcceptsUninvitedAthletes: !!result.awayAcceptsUninvitedAthletes,
    };
  }

  async getTeamMatchMatchdaySummary(eventId: string): Promise<{
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    scorers: Array<{
      userId: string;
      name: string;
      goals: number;
      position?: string;
      age?: number | null;
      avatarUrl?: string;
      teamSide?: string | null;
      teamName?: string;
    }>;
    homeTeamShieldUrl?: string;
    awayTeamShieldUrl?: string;
    referee: {
      userId: string;
      name: string;
      age?: number | null;
      avatarUrl?: string;
      score?: number | null;
    } | null;
    challengeConditions?: string;
    homeAcceptsUninvitedAthletes?: boolean;
    awayAcceptsUninvitedAthletes?: boolean;
    athleteConvocationBy?: 'president' | 'coach';
  }> {
    return (await Parse.Cloud.run('getTeamMatchMatchdaySummary', { eventId })) as {
      homeTeamName: string;
      awayTeamName: string;
      homeScore: number;
      awayScore: number;
      scorers: Array<{
        userId: string;
        name: string;
        goals: number;
        position?: string;
        age?: number | null;
        avatarUrl?: string;
        teamSide?: string | null;
      }>;
      referee: {
        userId: string;
        name: string;
        age?: number | null;
        avatarUrl?: string;
        score?: number | null;
      } | null;
      challengeConditions?: string;
      homeAcceptsUninvitedAthletes?: boolean;
      awayAcceptsUninvitedAthletes?: boolean;
      athleteConvocationBy?: 'president' | 'coach';
    };
  }

  async getTeamMatchConvocationAccess(eventId: string): Promise<{
    athleteConvocationBy: 'president' | 'coach';
    manageSides: Array<'home' | 'away'>;
    canManage: boolean;
    canSetMode: boolean;
  }> {
    const result = (await Parse.Cloud.run('getTeamMatchConvocationAccess', { eventId })) as {
      athleteConvocationBy?: string;
      manageSides?: string[];
      canManage?: boolean;
      canSetMode?: boolean;
    };
    const manageSides = (result.manageSides || []).filter(
      (side): side is 'home' | 'away' => side === 'home' || side === 'away'
    );
    return {
      athleteConvocationBy: result.athleteConvocationBy === 'coach' ? 'coach' : 'president',
      manageSides,
      canManage: !!result.canManage,
      canSetMode: !!result.canSetMode,
    };
  }

  async getTeamMatchGoalkeeperAlerts(eventId: string): Promise<
    Array<{ teamSide: 'home' | 'away'; teamName: string; unconfirmedCount: number; names: string[] }>
  > {
    const result = (await Parse.Cloud.run('getTeamMatchGoalkeeperAlerts', { eventId })) as {
      alerts?: Array<{
        teamSide?: string;
        teamName?: string;
        unconfirmedCount?: number;
        names?: string[];
      }>;
    };
    return (result.alerts || [])
      .filter((row) => row.teamSide === 'home' || row.teamSide === 'away')
      .map((row) => ({
        teamSide: row.teamSide as 'home' | 'away',
        teamName: String(row.teamName || (row.teamSide === 'away' ? 'Visitante' : 'Mandante')),
        unconfirmedCount: Number(row.unconfirmedCount || 0),
        names: Array.isArray(row.names) ? row.names.map(String) : [],
      }))
      .filter((row) => row.unconfirmedCount > 0);
  }

  async setTeamMatchAthleteConvocationBy(
    eventId: string,
    athleteConvocationBy: 'president' | 'coach'
  ): Promise<'president' | 'coach'> {
    const result = (await Parse.Cloud.run('setTeamMatchAthleteConvocationBy', {
      eventId,
      athleteConvocationBy,
    })) as { athleteConvocationBy?: string };
    this.notifyEventsChanged();
    return result.athleteConvocationBy === 'coach' ? 'coach' : 'president';
  }

  private toTeamMatchListItem(row: Record<string, unknown>): TeamMatchListItem {
    const address = (row['address'] as Address) || {
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
    };
    return {
      objectId: String(row['objectId'] || ''),
      name: String(row['name'] || ''),
      startTime: row['startTime'] ? new Date(String(row['startTime'])) : new Date(),
      endTime: row['endTime'] ? new Date(String(row['endTime'])) : new Date(),
      homeTeamName: String(row['homeTeamName'] || 'Mandante'),
      awayTeamName: String(row['awayTeamName'] || 'Visitante'),
      homeTeamId: row['homeTeamId'] ? String(row['homeTeamId']) : undefined,
      awayTeamId: row['awayTeamId'] ? String(row['awayTeamId']) : undefined,
      homeTeamShieldUrl: row['homeTeamShieldUrl']
        ? String(row['homeTeamShieldUrl'])
        : undefined,
      awayTeamShieldUrl: row['awayTeamShieldUrl']
        ? String(row['awayTeamShieldUrl'])
        : undefined,
      locationComplement: String(row['locationComplement'] || ''),
      address,
      hasReturnLeg: !!row['hasReturnLeg'],
      returnOfEventId: row['returnOfEventId'] ? String(row['returnOfEventId']) : undefined,
      adminId: row['adminId'] ? String(row['adminId']) : undefined,
      isFinished: !!row['isFinished'],
    };
  }

  private teamMatchRowToPeladaEvent(row: Record<string, unknown>): PeladaEvent {
    const item = this.toTeamMatchListItem(row);
    const now = new Date();
    const peladaName = typeof row['peladaName'] === 'string' ? row['peladaName'].trim() : '';
    return {
      objectId: item.objectId,
      name: item.name,
      peladaName: peladaName || undefined,
      type: 'team_match',
      startTime: item.startTime,
      endTime: item.endTime,
      address: item.address,
      locationComplement: item.locationComplement,
      adminId: item.adminId || '',
      adminName: 'Administrador',
      readOnlyAt: item.endTime,
      isReadOnly: item.endTime.getTime() < now.getTime(),
      registrationOpensAt: now,
      registrationClosesAt: item.startTime,
      useArrivalOrderForTeams: false,
      participationFee: 0,
      pixKey1: '',
      pixKey2: '',
      pixKey3: '',
      homeTeamName: item.homeTeamName,
      awayTeamName: item.awayTeamName,
      homeTeamId: item.homeTeamId,
      awayTeamId: item.awayTeamId,
      isFinished: !!item.isFinished,
    };
  }

  private sortEventsByProximity(events: PeladaEvent[], userAddress?: Address): PeladaEvent[] {
    const now = Date.now();
    return [...events].sort((a, b) => {
      const aPast = a.endTime.getTime() < now;
      const bPast = b.endTime.getTime() < now;
      if (aPast !== bPast) return aPast ? 1 : -1;

      const scoreDiff =
        locationProximityScore(userAddress, b.address) -
        locationProximityScore(userAddress, a.address);
      if (scoreDiff !== 0) return scoreDiff;

      if (aPast && bPast) {
        return b.endTime.getTime() - a.endTime.getTime();
      }
      return a.startTime.getTime() - b.startTime.getTime();
    });
  }

  async updateAdminSettings(eventId: string, payload: UpdateEventAdminPayload): Promise<PeladaEvent> {
    const user = Parse.User.current();
    if (!user) {
      throw new Error('Faca login para atualizar o evento.');
    }

    const query = new Parse.Query(EVENT_CLASS);
    includeEventRelations(query);
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
    includeEventRelations(query);
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
      homeTeamName:
        (obj.get('homeTeamName') as string) ||
        ((obj.get('homeTeam') as Parse.Object | undefined)?.get('name') as string) ||
        undefined,
      awayTeamName:
        (obj.get('awayTeamName') as string) ||
        ((obj.get('awayTeam') as Parse.Object | undefined)?.get('name') as string) ||
        undefined,
      homeTeamId: (obj.get('homeTeam') as Parse.Object | undefined)?.id,
      awayTeamId: (obj.get('awayTeam') as Parse.Object | undefined)?.id,
      homeTeamShieldUrl: teamShieldUrlFromParse(obj.get('homeTeam') as Parse.Object | undefined),
      awayTeamShieldUrl: teamShieldUrlFromParse(obj.get('awayTeam') as Parse.Object | undefined),
      isFinished: !!obj.get('isFinished'),
      homeAcceptsUninvitedAthletes: !!obj.get('homeAcceptsUninvitedAthletes'),
      awayAcceptsUninvitedAthletes: !!obj.get('awayAcceptsUninvitedAthletes'),
      athleteConvocationBy:
        obj.get('athleteConvocationBy') === 'coach' ? 'coach' : 'president',
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

  private applyTeamMatchFields(
    event: Parse.Object,
    payload: Pick<CreateEventPayload, 'homeTeamName' | 'awayTeamName' | 'homeTeamId' | 'awayTeamId'>
  ): void {
    const homeTeamId = payload.homeTeamId?.trim();
    const awayTeamId = payload.awayTeamId?.trim();
    if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
      throw new Error('Mandante e visitante precisam ser times diferentes.');
    }

    const homeTeamName = payload.homeTeamName?.trim();
    const awayTeamName = payload.awayTeamName?.trim();
    if (homeTeamName) event.set('homeTeamName', homeTeamName);
    if (awayTeamName) event.set('awayTeamName', awayTeamName);

    const TeamPointer = Parse.Object.extend(TEAM_CLASS);
    if (homeTeamId) {
      event.set('homeTeam', TeamPointer.createWithoutData(homeTeamId));
    }
    if (awayTeamId) {
      event.set('awayTeam', TeamPointer.createWithoutData(awayTeamId));
    }
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

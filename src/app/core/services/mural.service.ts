import { Injectable } from '@angular/core';
import Parse from 'parse';
import { MURAL_TARGET_ROLES, MuralTargetRole } from '../models/event-performance.model';
import { ProfileRole } from '../models/profile-role.model';
import { PeladaParticipant } from '../models/pelada-participant.model';
import {
  CastEventMuralVotePayload,
  CreateMuralVotePayload,
  EventMuralDashboard,
  EventMuralVoteSummary,
  MuralAppDashboard,
  MuralRankingEntry,
  MuralScope,
  MuralVote,
  MuralVoteAggregates,
} from '../models/mural.model';
import { isInvalidCloudFunctionError, parseErrorMessage } from '../utils/parse-error.util';
import { isGoalkeeperPosition, normalizeVoteTargetRole } from '../utils/mural-role.util';
import { EventPerformanceService } from './event-performance.service';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';
import { RegistrationService } from './registration.service';

const CLASS = 'MuralVote';

@Injectable({ providedIn: 'root' })
export class MuralService {
  constructor(
    private readonly parseService: ParseService,
    private readonly performanceService: EventPerformanceService,
    private readonly parseFileService: ParseFileService,
    private readonly registrationService: RegistrationService
  ) {
    this.parseService.init();
  }

  getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  async loadAppDashboard(): Promise<MuralAppDashboard> {
    try {
      const result = await Parse.Cloud.run('getMuralAppDashboard', { participantLimit: 500 });
      if (!result || typeof result !== 'object') {
        return this.emptyAppDashboard();
      }

      const raw = result as Record<string, unknown>;
      const participants = this.mapCloudParticipants(
        raw['participants'] as EventMuralDashboard['participants']
      );
      const rankings = (raw['rankings'] ?? this.emptyRankings()) as Record<
        MuralTargetRole,
        MuralRankingEntry[]
      >;
      this.applyParticipantMetaToRankings(rankings, participants);

      return {
        participants,
        rankings,
        voteAggregates: (raw['voteAggregates'] ?? {}) as MuralVoteAggregates,
        locationStats: this.normalizeAppLocationStats(raw['locationStats']),
        locationTopRankings: this.normalizeAppLocationTopRankings(raw['locationTopRankings']),
        performanceAnalytics: (raw['performanceAnalytics'] as Record<string, unknown>) ?? null,
        predictionRankings: this.normalizeAppPredictionRankings(raw['predictionRankings']),
        cloudAvailable: true,
      };
    } catch (error: unknown) {
      if (!isInvalidCloudFunctionError(error)) {
        console.warn('getMuralAppDashboard failed', error);
      }
      return this.loadAppDashboardFallback();
    }
  }

  private async loadAppDashboardFallback(): Promise<MuralAppDashboard> {
    const participants = await this.registrationService.listRecentParticipants();
    const participantIds = participants.map((participant) => participant.userId);

    const [rankings, voteAggregates, locationStats, locationTopRankings] = await Promise.all([
      this.getRankings('app'),
      this.getVoteAggregates('app'),
      this.muralParticipantStatsFallback(participants, participantIds),
      this.muralLocationTopFallback(),
    ]);

    return {
      participants,
      rankings,
      voteAggregates: voteAggregates ?? ({} as MuralVoteAggregates),
      locationStats,
      locationTopRankings,
      performanceAnalytics: null,
      predictionRankings: [],
      cloudAvailable: false,
    };
  }

  private emptyAppDashboard(): MuralAppDashboard {
    return {
      participants: [],
      rankings: this.emptyRankings(),
      voteAggregates: {} as MuralVoteAggregates,
      locationStats: { total: 0, byState: [], byCity: [], byNeighborhood: [] },
      locationTopRankings: { byState: [], byCity: [], byNeighborhood: [] },
      performanceAnalytics: null,
      predictionRankings: [],
      cloudAvailable: false,
    };
  }

  private normalizeAppLocationStats(raw: unknown): MuralAppDashboard['locationStats'] {
    if (!raw || typeof raw !== 'object') {
      return { total: 0, byState: [], byCity: [], byNeighborhood: [] };
    }
    const stats = raw as MuralAppDashboard['locationStats'];
    return {
      total: Number(stats.total) || 0,
      byState: Array.isArray(stats.byState) ? stats.byState : [],
      byCity: Array.isArray(stats.byCity) ? stats.byCity : [],
      byNeighborhood: Array.isArray(stats.byNeighborhood) ? stats.byNeighborhood : [],
    };
  }

  private normalizeAppLocationTopRankings(raw: unknown): MuralAppDashboard['locationTopRankings'] {
    if (!raw || typeof raw !== 'object') {
      return { byState: [], byCity: [], byNeighborhood: [] };
    }
    const rankings = raw as MuralAppDashboard['locationTopRankings'];
    return {
      byState: Array.isArray(rankings.byState) ? rankings.byState : [],
      byCity: Array.isArray(rankings.byCity) ? rankings.byCity : [],
      byNeighborhood: Array.isArray(rankings.byNeighborhood) ? rankings.byNeighborhood : [],
    };
  }

  private normalizeAppPredictionRankings(raw: unknown): MuralAppDashboard['predictionRankings'] {
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => {
      const entry = row as Record<string, unknown>;
      return {
        userId: String(entry['userId'] || ''),
        userName: String(entry['userName'] || 'Participante'),
        avatarUrl: entry['avatarUrl'] ? String(entry['avatarUrl']) : undefined,
        totalScore: Number(entry['totalScore']) || 0,
        eventsCount: Number(entry['eventsCount']) || 0,
      };
    });
  }

  private async muralParticipantStatsFallback(
    participants: PeladaParticipant[],
    participantIds: string[]
  ): Promise<MuralAppDashboard['locationStats']> {
    try {
      const result = await Parse.Cloud.run('getMuralParticipantLocationStats', {
        scope: 'app',
        userIds: participantIds,
      });
      if (result && typeof result === 'object' && Number((result as { total?: number }).total) > 0) {
        return this.normalizeAppLocationStats(result);
      }
    } catch {
      // fallback local abaixo
    }

    return {
      total: participants.length,
      byState: [],
      byCity: [],
      byNeighborhood: [],
    };
  }

  private async muralLocationTopFallback(): Promise<MuralAppDashboard['locationTopRankings']> {
    try {
      const result = await Parse.Cloud.run('getMuralLocationTopRankings', { scope: 'app' });
      if (result && typeof result === 'object') {
        return this.normalizeAppLocationTopRankings(result);
      }
    } catch {
      // ignora
    }
    return { byState: [], byCity: [], byNeighborhood: [] };
  }

  async loadEventMuralDashboard(eventId: string): Promise<EventMuralDashboard> {
    try {
      const result = await Parse.Cloud.run('getEventMuralDashboard', { eventId });
      if (!result || typeof result !== 'object') {
        return this.emptyEventMuralDashboard(eventId);
      }

      const raw = result as EventMuralDashboard & {
        participants?: EventMuralDashboard['participants'];
        myVotes?: Array<Record<string, unknown>>;
      };
      const rankings = (raw.rankings ?? {}) as Record<MuralTargetRole, MuralRankingEntry[]>;
      const participants = this.mapCloudParticipants(raw.participants);
      this.applyParticipantMetaToRankings(rankings, participants);

      return {
        rankings,
        voteSummary: this.normalizeEventVoteSummary(raw.voteSummary),
        participants: raw.participants,
        locationStats: raw.locationStats,
        myVotes: this.mapCloudMyVotes(raw.myVotes),
        cloudAvailable: true,
      };
    } catch (error: unknown) {
      if (!isInvalidCloudFunctionError(error)) {
        console.warn('getEventMuralDashboard failed', error);
      }
      return this.emptyEventMuralDashboard(eventId);
    }
  }

  mapCloudParticipants(rows?: EventMuralDashboard['participants']): PeladaParticipant[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
      userId: String(row.userId || ''),
      userName: String(row.userName || 'Participante'),
      apelido: String(row.apelido || ''),
      fullName: row.fullName ? String(row.fullName) : undefined,
      roles: Array.isArray(row.roles) ? (row.roles as ProfileRole[]) : ['athlete'],
      avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
      birthDate: row.birthDate ? new Date(String(row.birthDate)) : undefined,
      address: row.address,
      proFootballIdol: row.proFootballIdol ? String(row.proFootballIdol) : undefined,
      amateurFootballIdol: row.amateurFootballIdol ? String(row.amateurFootballIdol) : undefined,
    }));
  }

  async getRankings(
    scope: MuralScope,
    scopeId?: string,
    limit = 10
  ): Promise<Record<MuralTargetRole, MuralRankingEntry[]>> {
    if (scope === 'event' && scopeId) {
      const dashboard = await this.loadEventMuralDashboard(scopeId);
      if (dashboard.cloudAvailable) {
        return dashboard.rankings;
      }
    }

    const fromCloud = await this.getRankingsViaCloud(scope, scopeId, limit);
    if (fromCloud) {
      return fromCloud;
    }

    if (scope === 'event' || scope === 'app' || scope === 'pelada') {
      return this.emptyRankings();
    }

    return this.emptyRankings();
  }

  async listMyVotesForEvent(eventId: string): Promise<MuralVote[]> {
    try {
      const rows = await Parse.Cloud.run('listMyEventMuralVotes', { eventId });
      if (Array.isArray(rows)) {
        return this.mapCloudMyVotes(rows);
      }
    } catch (error: unknown) {
      if (!isInvalidCloudFunctionError(error)) {
        console.warn('listMyEventMuralVotes failed', error);
      }
    }

    const sessionUser = Parse.User.current();
    if (!sessionUser?.id) {
      return [];
    }

    const query = new Parse.Query(CLASS);
    query.equalTo('scope', 'event');
    query.equalTo('scopeId', eventId);
    query.equalTo('period', eventId);
    query.equalTo('voter', Parse.User.createWithoutData(sessionUser.id));
    query.limit(500);
    const results = await query.find();
    return results.map((obj) => this.toVote(obj));
  }

  async getEventVoteSummary(eventId: string): Promise<EventMuralVoteSummary | null> {
    const dashboard = await this.loadEventMuralDashboard(eventId);
    if (dashboard.cloudAvailable) {
      return dashboard.voteSummary;
    }

    try {
      const result = await Parse.Cloud.run('getEventMuralVoteSummary', { eventId });
      if (!result || typeof result !== 'object') {
        return null;
      }
      return this.normalizeEventVoteSummary(result);
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        return {
          totalVotes: 0,
          voterCount: 0,
          totalParticipants: await this.countEventParticipants(eventId),
          votePercentage: 0,
        };
      }
      return null;
    }
  }

  private async emptyEventMuralDashboard(eventId: string): Promise<EventMuralDashboard> {
    return {
      rankings: this.emptyRankings(),
      voteSummary: {
        totalVotes: 0,
        voterCount: 0,
        totalParticipants: await this.countEventParticipants(eventId),
        votePercentage: 0,
        voterQuorumMet: false,
        minVoters: 3,
      },
      cloudAvailable: false,
    };
  }

  private mapCloudMyVotes(rows?: Array<Record<string, unknown>>): MuralVote[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
      objectId: String(row['objectId'] || ''),
      scope: 'event',
      scopeId: String(row['scopeId'] || ''),
      voterId: String(row['voterId'] || ''),
      targetUserId: String(row['targetUserId'] || ''),
      targetUserName: String(row['targetUserName'] || 'Participante'),
      targetRole: (row['targetRole'] as MuralTargetRole) || 'athlete',
      score: Number(row['score'] ?? 0),
      period: String(row['period'] || ''),
      createdAt: row['createdAt'] ? new Date(String(row['createdAt'])) : new Date(),
      targetAvatarUrl: row['targetAvatarUrl'] ? String(row['targetAvatarUrl']) : undefined,
    }));
  }

  private applyParticipantMetaToRankings(
    rankings: Record<MuralTargetRole, MuralRankingEntry[]>,
    participants: PeladaParticipant[]
  ): void {
    const byId = new Map(participants.map((row) => [row.userId, row]));
    for (const role of MURAL_TARGET_ROLES) {
      for (const entry of rankings[role] ?? []) {
        const participant = byId.get(entry.userId);
        if (!participant) continue;
        entry.userName = participant.apelido || participant.userName || entry.userName;
        if (participant.avatarUrl) {
          entry.avatarUrl = participant.avatarUrl;
        }
      }
    }
  }

  async getGoalkeeperUserIdsForScope(scope: MuralScope, scopeId?: string): Promise<Set<string>> {
    return this.loadGoalkeeperUserIdsForScope(scope, scopeId);
  }

  async getVoteAggregates(scope: MuralScope, scopeId?: string): Promise<MuralVoteAggregates | null> {
    try {
      const result = await Parse.Cloud.run('getMuralVoteAggregates', { scope, scopeId });
      if (!result || typeof result !== 'object') {
        return null;
      }
      return result as MuralVoteAggregates;
    } catch {
      return this.buildVoteAggregatesClient(scope, scopeId);
    }
  }

  private async buildVoteAggregatesClient(
    scope: MuralScope,
    scopeId?: string
  ): Promise<MuralVoteAggregates | null> {
    const goalkeeperUserIds = await this.loadGoalkeeperUserIdsForScope(scope, scopeId);
    const votes = this.normalizeVotesForScope(
      await this.listVotesForScope(scope, scopeId),
      goalkeeperUserIds
    );
    if (!votes.length) return null;

    const aggregates = MURAL_TARGET_ROLES.reduce((acc, role) => {
      acc[role] = {};
      return acc;
    }, {} as MuralVoteAggregates);

    for (const vote of votes) {
      if (!vote.targetUserId) continue;
      const role = vote.targetRole;
      const current = aggregates[role][vote.targetUserId] ?? {
        totalScore: 0,
        voteCount: 0,
        userName: vote.targetUserName,
      };
      current.totalScore += vote.score;
      current.voteCount += 1;
      if (vote.targetUserName && vote.targetUserName !== 'Participante') {
        current.userName = vote.targetUserName;
      }
      aggregates[role][vote.targetUserId] = current;
    }
    return aggregates;
  }

  private async getRankingsViaCloud(
    scope: MuralScope,
    scopeId?: string,
    limit = 10
  ): Promise<Record<MuralTargetRole, MuralRankingEntry[]> | null> {
    try {
      const result = await Parse.Cloud.run('getMuralRankings', { scope, scopeId, limit });
      if (!result || typeof result !== 'object') {
        return null;
      }
      return result as Record<MuralTargetRole, MuralRankingEntry[]>;
    } catch {
      return null;
    }
  }

  private emptyRankings(): Record<MuralTargetRole, MuralRankingEntry[]> {
    return MURAL_TARGET_ROLES.reduce(
      (acc, role) => {
        acc[role] = [];
        return acc;
      },
      {} as Record<MuralTargetRole, MuralRankingEntry[]>
    );
  }

  private normalizeEventVoteSummary(result: unknown): EventMuralVoteSummary {
    const raw = result as EventMuralVoteSummary;
    const voterCount = Number(raw.voterCount) || 0;
    const totalParticipants = Number(raw.totalParticipants) || 0;
    const votePercentage =
      raw.votePercentage != null && !Number.isNaN(Number(raw.votePercentage))
        ? Number(raw.votePercentage)
        : totalParticipants > 0
          ? Math.round((voterCount / totalParticipants) * 1000) / 10
          : 0;

    return {
      totalVotes: Number(raw.totalVotes) || 0,
      voterCount,
      totalParticipants,
      votePercentage,
      voterQuorumMet:
        raw.voterQuorumMet != null ? !!raw.voterQuorumMet : voterCount >= 3,
      minVoters: Number(raw.minVoters) || 3,
    };
  }

  private async countEventParticipants(eventId: string): Promise<number> {
    const participants = await this.registrationService.listParticipantsForEvent(eventId);
    return participants.length;
  }

  private async listVotesForScope(scope: MuralScope, scopeId?: string): Promise<MuralVote[]> {
    if (scope === 'app') {
      return [];
    }

    if (scope === 'pelada' && scopeId) {
      const peladaVotes = await this.listVotes('pelada', scopeId);
      const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(scopeId);
      const eventQuery = new Parse.Query('Event');
      eventQuery.equalTo('pelada', peladaPtr);
      eventQuery.limit(500);
      const events = await eventQuery.find();
      const eventIds = events.map((event) => event.id!).filter(Boolean);
      if (!eventIds.length) {
        return peladaVotes;
      }

      const eventVoteQuery = new Parse.Query(CLASS);
      eventVoteQuery.equalTo('scope', 'event');
      eventVoteQuery.containedIn('scopeId', eventIds);
      eventVoteQuery.limit(3000);
      const eventVotes = await eventVoteQuery.find();
      return [...peladaVotes, ...eventVotes.map((obj) => this.toVote(obj))];
    }

    return this.listVotes(scope, scopeId);
  }

  async submitEventMuralBallot(payload: {
    eventId: string;
    period: string;
    votes: CastEventMuralVotePayload[];
  }): Promise<void> {
    const sessionUser = Parse.User.current();
    if (!sessionUser?.id) {
      throw new Error('Sessao invalida. Faca login novamente.');
    }

    if (!payload.votes.length) {
      throw new Error('Atribua nota de 0 a 10 para ao menos um participante.');
    }

    for (const vote of payload.votes) {
      if (vote.score < 0 || vote.score > 10) {
        throw new Error('A nota deve ser entre 0 e 10.');
      }
      if (!vote.registrationId?.trim()) {
        throw new Error('Inscricao invalida para votacao.');
      }
    }

    try {
      await Parse.Cloud.run('submitEventMuralBallot', {
        eventId: payload.eventId,
        period: payload.period,
        votes: payload.votes.map((vote) => ({
          registrationId: vote.registrationId,
          targetRole: vote.targetRole,
          score: vote.score,
        })),
      });
    } catch (error: unknown) {
      if (!isInvalidCloudFunctionError(error)) {
        throw new Error(parseErrorMessage(error));
      }

      throw new Error(
        'Nao foi possivel registrar a votacao. Publique o Cloud Code mais recente no Back4App.'
      );
    }
  }

  async voteForEventRegistration(payload: CastEventMuralVotePayload): Promise<void> {
    await this.submitEventMuralBallot({
      eventId: payload.eventId,
      period: payload.period,
      votes: [payload],
    });
  }

  async vote(payload: CreateMuralVotePayload): Promise<MuralVote> {
    throw new Error(
      'Votos do mural so podem ser registrados via Cloud Code (cedula do evento).'
    );
  }

  async listVotes(scope: MuralScope, scopeId?: string): Promise<MuralVote[]> {
    const query = new Parse.Query(CLASS);
    query.equalTo('scope', scope);
    if (scopeId) {
      query.equalTo('scopeId', scopeId);
    } else {
      query.doesNotExist('scopeId');
    }
    query.limit(500);
    const results = await query.find();
    return results.map((obj) => this.toVote(obj));
  }

  private aggregateVotes(votes: MuralVote[]): Map<string, { total: number; count: number }> {
    const map = new Map<string, { total: number; count: number }>();
    for (const vote of votes) {
      const key = `${vote.targetUserId}:${vote.targetRole}`;
      const current = map.get(key) ?? { total: 0, count: 0 };
      current.total += vote.score;
      current.count += 1;
      map.set(key, current);
    }
    return map;
  }

  private toVote(obj: Parse.Object): MuralVote {
    const voter = obj.get('voter') as Parse.User | undefined;
    const targetUser = obj.get('targetUser') as Parse.User | undefined;
    const targetUserId =
      (obj.get('targetUserId') as string | undefined)?.trim() || targetUser?.id || '';
    return {
      objectId: obj.id!,
      scope: obj.get('scope') as MuralScope,
      scopeId: obj.get('scopeId') as string | undefined,
      voterId: voter?.id ?? '',
      targetUserId,
      targetUserName:
        (obj.get('targetDisplayName') as string) ||
        (targetUser?.get('apelido') as string) ||
        (targetUser?.get('name') as string) ||
        targetUser?.getUsername() ||
        'Participante',
      targetRole: obj.get('targetRole') as MuralTargetRole,
      score: Number(obj.get('score') ?? 0),
      period: (obj.get('period') as string) ?? '',
      createdAt: (obj.get('createdAt') as Date) ?? new Date(),
      targetAvatarUrl: (obj.get('targetAvatarUrl') as string | undefined) || undefined,
    };
  }

  private normalizeVotesForScope(
    votes: MuralVote[],
    goalkeeperUserIds: Set<string>
  ): MuralVote[] {
    return votes.map((vote) => ({
      ...vote,
      targetRole: normalizeVoteTargetRole(
        vote.targetUserId,
        vote.targetRole,
        goalkeeperUserIds
      ),
    }));
  }

  private async loadGoalkeeperUserIdsForScope(
    scope: MuralScope,
    scopeId?: string
  ): Promise<Set<string>> {
    const ids = new Set<string>();

    const addFromEventRegistrations = async (eventIds: string[]): Promise<void> => {
      if (!eventIds.length) return;

      const eventPtrs = eventIds.map((eventId) =>
        Parse.Object.extend('Event').createWithoutData(eventId)
      );
      const query = new Parse.Query('EventRegistration');
      query.containedIn('event', eventPtrs);
      query.include('athlete');
      query.limit(Math.min(eventIds.length * 500, 5000));
      const registrations = await query.find();

      for (const registration of registrations) {
          const userId = this.resolveRegistrationUserId(registration);
          if (!userId) continue;

          const role = String(registration.get('role') || 'athlete');
          const athlete = registration.get('athlete') as Parse.Object | undefined;
          const primaryPosition =
            (registration.get('primaryPosition') as string | undefined) ||
            (athlete?.get('primaryPosition') as string | undefined);

          if (role === 'goalkeeper' || (role === 'athlete' && isGoalkeeperPosition(primaryPosition))) {
            ids.add(userId);
          }
        }
    };

    if (scope === 'event' && scopeId) {
      await addFromEventRegistrations([scopeId]);
      return ids;
    }

    if (scope === 'pelada' && scopeId) {
      const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(scopeId);
      const eventQuery = new Parse.Query('Event');
      eventQuery.equalTo('pelada', peladaPtr);
      eventQuery.limit(500);
      const events = await eventQuery.find();
      const eventIds = events.map((event) => event.id!).filter(Boolean);
      await addFromEventRegistrations(eventIds);
      return ids;
    }

    const athleteQuery = new Parse.Query('AthleteProfile');
    athleteQuery.limit(5000);
    const profiles = await athleteQuery.find();
    for (const profile of profiles) {
      if (!isGoalkeeperPosition(profile.get('primaryPosition') as string | undefined)) continue;
      const user = profile.get('user') as Parse.User | undefined;
      if (user?.id) ids.add(user.id);
    }

    return ids;
  }

  private resolveRegistrationUserId(registration: Parse.Object): string {
    const explicit = (registration.get('participantUserId') as string | undefined)?.trim();
    if (explicit) return explicit;
    const user = registration.get('user') as Parse.User | undefined;
    return user?.id ?? '';
  }
}

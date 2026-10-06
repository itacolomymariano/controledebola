import { Injectable } from '@angular/core';
import Parse from 'parse';
import { EventType } from '../models/event.model';
import { MuralTargetRole } from '../models/event-performance.model';
import { ProfileRole } from '../models/profile-role.model';
import { ProfessionalRole, ROLE_HISTORY_MODE } from '../models/role-profile.model';
import {
  RoleParticipationHistory,
  RoleParticipationRecord,
} from '../models/role-participation-history.model';
import { profileRoleToMuralRole } from '../utils/mural-role.util';
import { ParseService } from './parse.service';

const REGISTRATION_CLASS = 'EventRegistration';

@Injectable({ providedIn: 'root' })
export class RoleProfileHistoryService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async getHistoryForCurrentUser(role: ProfessionalRole): Promise<RoleParticipationHistory> {
    const user = Parse.User.current();
    if (!user?.id) {
      return { peladas: [], matches: [], teams: [] };
    }
    return this.getHistory(role, user.id);
  }

  async getHistory(role: ProfileRole, userId: string): Promise<RoleParticipationHistory> {
    const mode = ROLE_HISTORY_MODE[role as ProfessionalRole] ?? 'none';
    if (mode === 'none') {
      return { peladas: [], matches: [], teams: [] };
    }

    const muralRole = profileRoleToMuralRole(role);
    const userPtr = Parse.User.createWithoutData(userId);

    const regQuery = new Parse.Query(REGISTRATION_CLASS);
    regQuery.equalTo('user', userPtr);
    regQuery.equalTo('role', role);
    regQuery.include('event');
    regQuery.include('event.pelada');
    regQuery.limit(2000);
    const registrations = await regQuery.find();

    const eventsById = new Map<string, Parse.Object>();
    for (const registration of registrations) {
      const event = registration.get('event') as Parse.Object | undefined;
      if (!event?.id) continue;
      eventsById.set(event.id, event);
    }
    const events = Array.from(eventsById.values());
    const perfsByEvent = await this.loadPerformancesForEvents(events);
    const eventVoteAverages = muralRole
      ? await this.loadVoteAverages(
          userId,
          muralRole,
          'event',
          events.map((event) => event.id).filter((id): id is string => !!id)
        )
      : new Map<string, number>();
    const peladaIds = events
      .filter((event) => event.get('type') !== 'team_match')
      .map((event) => (event.get('pelada') as Parse.Object | undefined)?.id)
      .filter((id): id is string => !!id);
    const peladaVoteAverages = muralRole
      ? await this.loadVoteAverages(userId, muralRole, 'pelada', peladaIds)
      : new Map<string, number>();

    const peladaScores = new Map<string, RoleParticipationRecord>();
    const matchScores = new Map<string, RoleParticipationRecord>();
    const teamScores = new Map<string, RoleParticipationRecord>();
    const peladaEventVoteAverages = new Map<string, number[]>();

    for (const event of events) {
      if (!event.id) continue;
      const eventType = event.get('type') as EventType | undefined;
      const performanceScore = this.scoreHistoryEvent(
        userId,
        muralRole || role,
        perfsByEvent.get(event.id) ?? []
      );
      const eventVote = event.id ? eventVoteAverages.get(event.id) : undefined;

      if (eventType === 'team_match') {
        const score = performanceScore + (eventVote != null ? eventVote * 10 : 0);
        const home = (event.get('homeTeamName') as string | undefined)?.trim();
        const away = (event.get('awayTeamName') as string | undefined)?.trim();
        const matchLabel =
          home && away ? `${home} x ${away}` : (event.get('name') as string) || 'Partida';

        this.upsertRecord(matchScores, event.id, matchLabel, score);

        if (mode === 'teams_only' || mode === 'pelada_teams') {
          if (home) this.upsertRecord(teamScores, `team:${home}`, home, score);
          if (away) this.upsertRecord(teamScores, `team:${away}`, away, score);
        }
        continue;
      }

      const pelada = event.get('pelada') as Parse.Object | undefined;
      const peladaId = pelada?.id;
      const peladaName = (pelada?.get('name') as string | undefined) || (event.get('name') as string);
      if (!peladaId || !peladaName || (mode !== 'pelada_match' && mode !== 'pelada_teams')) {
        continue;
      }

      const existing = peladaScores.get(peladaId);
      if (!existing) {
        peladaScores.set(peladaId, { id: peladaId, name: peladaName, score: performanceScore });
      } else {
        existing.score += performanceScore;
      }
      if (eventVote != null) {
        const samples = peladaEventVoteAverages.get(peladaId) ?? [];
        samples.push(eventVote);
        peladaEventVoteAverages.set(peladaId, samples);
      }
    }

    for (const [peladaId, record] of peladaScores) {
      const samples = peladaEventVoteAverages.get(peladaId) ?? [];
      const peladaVote = peladaVoteAverages.get(peladaId);
      if (peladaVote != null) samples.push(peladaVote);
      if (!samples.length) continue;
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      record.score += average * 10;
    }

    const sortByName = (a: RoleParticipationRecord, b: RoleParticipationRecord) =>
      a.name.localeCompare(b.name, 'pt-BR');

    return {
      peladas: Array.from(peladaScores.values()).sort(sortByName),
      matches: Array.from(matchScores.values()).sort(sortByName),
      teams: Array.from(teamScores.values()).sort(sortByName),
    };
  }

  private upsertRecord(
    map: Map<string, RoleParticipationRecord>,
    id: string,
    name: string,
    score: number
  ): void {
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { id, name, score });
      return;
    }
    existing.score = Math.max(existing.score, score);
  }

  /**
   * Usa os Event ja incluidos na inscricao.
   * createWithoutData dentro de containedIn volta vazio.
   */
  private async loadPerformancesForEvents(
    events: Parse.Object[]
  ): Promise<Map<string, Parse.Object[]>> {
    const byEvent = new Map<string, Parse.Object[]>();
    const loaded = events.filter((event) => !!event?.id);
    try {
      for (let i = 0; i < loaded.length; i += 40) {
        const batch = loaded.slice(i, i + 40);
        let skip = 0;
        for (;;) {
          const query = new Parse.Query('EventPerformance');
          query.containedIn('event', batch);
          query.limit(1000);
          query.skip(skip);
          const rows = await query.find();
          for (const perf of rows) {
            const event = perf.get('event') as Parse.Object | undefined;
            const eventId = event?.id;
            if (!eventId) continue;
            const list = byEvent.get(eventId) ?? [];
            list.push(perf);
            byEvent.set(eventId, list);
          }
          if (rows.length < 1000) break;
          skip += rows.length;
          if (skip > 8000) break;
        }
      }
    } catch {
      return byEvent;
    }
    return byEvent;
  }

  private async loadVoteAverages(
    userId: string,
    muralRole: MuralTargetRole,
    scope: 'pelada' | 'event',
    scopeIds: string[]
  ): Promise<Map<string, number>> {
    const averages = new Map<string, number>();
    const ids = [...new Set(scopeIds.filter(Boolean))];
    if (!ids.length) return averages;

    const totals = new Map<string, { total: number; count: number }>();
    try {
      for (let i = 0; i < ids.length; i += 80) {
        const batch = ids.slice(i, i + 80);
        const query = new Parse.Query('MuralVote');
        query.equalTo('scope', scope);
        query.equalTo('targetRole', muralRole);
        query.containedIn('scopeId', batch);
        query.limit(1000);
        const votes = await query.find();
        for (const vote of votes) {
          const targetUser = vote.get('targetUser') as Parse.User | undefined;
          const targetId =
            (vote.get('targetUserId') as string | undefined)?.trim() || targetUser?.id || '';
          if (targetId !== userId) continue;
          const scopeId = String(vote.get('scopeId') || '');
          if (!scopeId) continue;
          const current = totals.get(scopeId) ?? { total: 0, count: 0 };
          current.total += Number(vote.get('score') ?? 0);
          current.count += 1;
          totals.set(scopeId, current);
        }
      }
    } catch {
      return averages;
    }

    for (const [scopeId, data] of totals) {
      if (data.count > 0) averages.set(scopeId, data.total / data.count);
    }
    return averages;
  }

  private scoreHistoryEvent(userId: string, role: string, perfs: Parse.Object[]): number {
    const seen = new Set<string>();
    let total = 0;
    for (const perf of perfs) {
      if (!perf.id || seen.has(perf.id)) continue;
      seen.add(perf.id);
      if (role === 'referee' && this.hasRefereeSumula(perf)) {
        total += this.refereeSumulaScore(perf);
        continue;
      }
      if (!this.performanceMatchesUser(perf, userId)) continue;
      const rowRole = (perf.get('role') as string | undefined) || 'athlete';
      if (rowRole !== role) continue;
      total += this.performanceScore(perf);
    }
    return total;
  }

  private performanceMatchesUser(perf: Parse.Object, userId: string): boolean {
    const explicit = (perf.get('participantUserId') as string | undefined)?.trim();
    if (explicit && explicit === userId) return true;
    const user = perf.get('user') as Parse.User | undefined;
    return user?.id === userId;
  }

  private hasRefereeSumula(perf: Parse.Object): boolean {
    if (perf.get('refereeSumulaSaved')) return true;
    if (Number(perf.get('refereeGoals') ?? 0) > 0) return true;
    if (Number(perf.get('refereeGoalsConceded') ?? 0) > 0) return true;
    if (Number(perf.get('refereeYellowCards') ?? 0) > 0) return true;
    if (Number(perf.get('refereeRedCards') ?? 0) > 0) return true;
    if (Number(perf.get('refereeFoulsCommitted') ?? 0) > 0) return true;
    if (String(perf.get('refereeObservation') || '').trim()) return true;
    return false;
  }

  private refereeSumulaScore(perf: Parse.Object): number {
    const goals = Number(
      perf.get('refereeGoals') != null ? perf.get('refereeGoals') : (perf.get('goals') ?? 0)
    );
    const yellow = Number(
      perf.get('refereeYellowCards') != null
        ? perf.get('refereeYellowCards')
        : (perf.get('yellowCards') ?? 0)
    );
    const red = Number(
      perf.get('refereeRedCards') != null ? perf.get('refereeRedCards') : (perf.get('redCards') ?? 0)
    );
    const assists = Number(perf.get('assists') ?? 0);
    const saves = Number(perf.get('saves') ?? 0);
    const stored = Number(perf.get('points') ?? 0);
    const fromSumula = goals * 3 + assists * 2 + saves * 2 - yellow - red * 3;
    if (goals > 0 || yellow > 0 || red > 0) return fromSumula;
    return stored > 0 ? stored : fromSumula;
  }

  private performanceScore(perf: Parse.Object): number {
    const goals = Number(perf.get('goals') ?? 0);
    const assists = Number(perf.get('assists') ?? 0);
    const saves = Number(perf.get('saves') ?? 0);
    const yellow = Number(perf.get('yellowCards') ?? 0);
    const red = Number(perf.get('redCards') ?? 0);
    const points = Number(perf.get('points') ?? 0);
    return points + goals * 3 + assists * 2 + saves * 2 - yellow - red * 3;
  }
}

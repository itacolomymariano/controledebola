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
import { MuralService } from './mural.service';
import { ParseService } from './parse.service';

const REGISTRATION_CLASS = 'EventRegistration';

@Injectable({ providedIn: 'root' })
export class RoleProfileHistoryService {
  constructor(
    private readonly parseService: ParseService,
    private readonly muralService: MuralService
  ) {
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

    const peladaScores = new Map<string, RoleParticipationRecord>();
    const matchScores = new Map<string, RoleParticipationRecord>();
    const teamScores = new Map<string, RoleParticipationRecord>();
    const peladaRankingCache = new Map<string, number>();
    const eventRankingCache = new Map<string, number>();

    for (const registration of registrations) {
      const event = registration.get('event') as Parse.Object | undefined;
      if (!event?.id) continue;

      const eventType = event.get('type') as EventType | undefined;
      const pelada = event.get('pelada') as Parse.Object | undefined;
      const peladaId = pelada?.id;
      const peladaName = (pelada?.get('name') as string | undefined) || (event.get('name') as string);

      const score = muralRole
        ? await this.getMuralScore(
            userId,
            muralRole,
            eventType === 'team_match' ? 'event' : 'pelada',
            eventType === 'team_match' ? event.id : peladaId,
            eventType === 'team_match' ? eventRankingCache : peladaRankingCache
          )
        : 0;

      if (eventType === 'team_match') {
        const home = (event.get('homeTeamName') as string | undefined)?.trim();
        const away = (event.get('awayTeamName') as string | undefined)?.trim();
        const matchLabel =
          home && away ? `${home} x ${away}` : (event.get('name') as string) || 'Partida';

        this.upsertRecord(matchScores, event.id, matchLabel, score);

        if (mode === 'teams_only' || mode === 'pelada_teams') {
          if (home) this.upsertRecord(teamScores, `team:${home}`, home, score);
          if (away) this.upsertRecord(teamScores, `team:${away}`, away, score);
        }
      } else if (peladaId && peladaName && (mode === 'pelada_match' || mode === 'pelada_teams')) {
        this.upsertRecord(peladaScores, peladaId, peladaName, score);
      }
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

  private async getMuralScore(
    userId: string,
    muralRole: MuralTargetRole,
    scope: 'pelada' | 'event',
    scopeId: string | undefined,
    cache: Map<string, number>
  ): Promise<number> {
    if (!scopeId) return 0;

    const cacheKey = `${scope}:${scopeId}:${muralRole}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey) ?? 0;
    }

    const rankings = await this.muralService.getRankings(scope, scopeId);
    const entry = rankings[muralRole]?.find((row) => row.userId === userId);
    const score = entry?.combinedScore ?? 0;
    cache.set(cacheKey, score);
    return score;
  }
}

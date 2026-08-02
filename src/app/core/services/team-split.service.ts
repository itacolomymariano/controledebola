import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  EventTeamSplitState,
  SaveEventTeamSplitPayload,
  TeamSplitAthlete,
  TeamSplitMode,
  TeamSplitRandomStrategy,
} from '../models/team-split.model';
import {
  isCloudFunctionUnavailableError,
  parseErrorMessage,
} from '../utils/parse-error.util';
import { ParseService } from './parse.service';

const EVENT_CLASS = 'Event';

@Injectable({ providedIn: 'root' })
export class TeamSplitService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async getSavedSplit(eventId: string): Promise<EventTeamSplitState | null> {
    try {
      const result = await Parse.Cloud.run('getEventTeamSplit', { eventId });
      return this.normalizeSavedState(result);
    } catch (error) {
      if (!isCloudFunctionUnavailableError(error)) {
        console.warn('getEventTeamSplit failed', error);
      }
      return this.getSavedSplitClient(eventId);
    }
  }

  async saveSplit(payload: SaveEventTeamSplitPayload): Promise<EventTeamSplitState> {
    try {
      const result = await Parse.Cloud.run('saveEventTeamSplit', payload);
      const normalized = this.normalizeSavedState(result);
      if (!normalized) {
        throw new Error('Resposta invalida ao salvar separacao.');
      }
      return normalized;
    } catch (error: unknown) {
      if (isCloudFunctionUnavailableError(error)) {
        return this.saveSplitClient(payload);
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async listAthletesForEvent(eventId: string): Promise<TeamSplitAthlete[]> {
    try {
      const rows = await Parse.Cloud.run('listEventAthletesForTeamSplit', { eventId });
      if (Array.isArray(rows)) {
        return rows.map((row) => this.mapAthlete(row));
      }
    } catch (error) {
      console.warn('listEventAthletesForTeamSplit indisponivel.', error);
    }
    return [];
  }

  private async getSavedSplitClient(eventId: string): Promise<EventTeamSplitState | null> {
    const user = Parse.User.current();
    if (!user) return null;

    try {
      const query = new Parse.Query(EVENT_CLASS);
      query.include('admin');
      const event = await query.get(eventId);
      const ended =
        !!event.get('isFinished') ||
        (event.get('endTime') instanceof Date && event.get('endTime') < new Date());
      if (!ended) {
        const admin = event.get('admin') as Parse.User | undefined;
        if (admin?.id !== user.id) return null;
      }
      return this.normalizeSavedState(event.get('teamSplit'));
    } catch {
      return null;
    }
  }

  private async saveSplitClient(payload: SaveEventTeamSplitPayload): Promise<EventTeamSplitState> {
    const user = Parse.User.current();
    if (!user) {
      throw new Error('Faca login para salvar a separacao.');
    }

    const query = new Parse.Query(EVENT_CLASS);
    query.include('admin');
    const event = await query.get(payload.eventId);
    const admin = event.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode salvar a separacao.');
    }

    const state = this.buildTeamSplitState(payload);
    event.set('teamSplit', state);
    await event.save();

    const normalized = this.normalizeSavedState(state);
    if (!normalized) {
      throw new Error('Nao foi possivel salvar a separacao.');
    }
    return normalized;
  }

  private buildTeamSplitState(payload: SaveEventTeamSplitPayload): Record<string, unknown> {
    const validStrategies: TeamSplitRandomStrategy[] = [
      'default',
      'marital',
      'favoriteTeam',
      'neighborhood',
    ];
    const randomStrategy =
      payload.randomStrategy && validStrategies.includes(payload.randomStrategy)
        ? payload.randomStrategy
        : 'default';

    return {
      athletesPerTeam: Math.max(1, Math.min(20, Number(payload.athletesPerTeam) || 1)),
      teamCount: Math.max(1, Math.min(8, Number(payload.teamCount) || 1)),
      splitMode: payload.splitMode === 'random' ? 'random' : 'manual',
      randomStrategy,
      teams: payload.teams
        .map((team) => team.map((userId) => String(userId || '')).filter(Boolean))
        .slice(0, 8),
      savedAt: new Date().toISOString(),
    };
  }

  private normalizeSavedState(raw: unknown): EventTeamSplitState | null {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;
    const teamsRaw = entry['teams'];
    if (!Array.isArray(teamsRaw)) return null;

    const athletesPerTeam = Number(entry['athletesPerTeam']);
    const teamCount = Number(entry['teamCount']);
    if (!athletesPerTeam || !teamCount) return null;

    const splitMode = entry['splitMode'] === 'random' ? 'random' : 'manual';
    const randomStrategy = entry['randomStrategy'] as TeamSplitRandomStrategy | undefined;
    const validStrategies: TeamSplitRandomStrategy[] = [
      'default',
      'marital',
      'favoriteTeam',
      'neighborhood',
    ];

    return {
      athletesPerTeam: Math.max(1, Math.min(20, athletesPerTeam)),
      teamCount: Math.max(1, Math.min(8, teamCount)),
      splitMode: splitMode as TeamSplitMode,
      randomStrategy:
        randomStrategy && validStrategies.includes(randomStrategy) ? randomStrategy : 'default',
      teams: teamsRaw.map((team) =>
        Array.isArray(team) ? team.map((userId) => String(userId || '')).filter(Boolean) : []
      ),
      savedAt: entry['savedAt'] ? String(entry['savedAt']) : undefined,
    };
  }

  private mapAthlete(row: unknown): TeamSplitAthlete {
    const entry = row as Record<string, unknown>;
    return {
      userId: String(entry['userId'] || ''),
      registrationId: String(entry['registrationId'] || ''),
      apelido: String(entry['apelido'] || entry['userName'] || 'Atleta'),
      userName: String(entry['userName'] || entry['apelido'] || 'Atleta'),
      avatarUrl: entry['avatarUrl'] ? String(entry['avatarUrl']) : undefined,
      primaryPosition: entry['primaryPosition'] ? String(entry['primaryPosition']) : undefined,
      age: entry['age'] != null && !Number.isNaN(Number(entry['age'])) ? Number(entry['age']) : undefined,
      accumulatedPoints: Number(entry['accumulatedPoints']) || 0,
      membershipType:
        entry['membershipType'] === 'socio' ? 'socio' : ('convidado' as const),
      isSocio: !!entry['isSocio'],
      maritalStatus:
        entry['maritalStatus'] === 'casado' || entry['maritalStatus'] === 'solteiro'
          ? entry['maritalStatus']
          : undefined,
      footPreference:
        entry['footPreference'] === 'destro' ||
        entry['footPreference'] === 'ambidestro' ||
        entry['footPreference'] === 'canhoto'
          ? entry['footPreference']
          : undefined,
      favoriteProTeam: entry['favoriteProTeam'] ? String(entry['favoriteProTeam']) : undefined,
      neighborhood: entry['neighborhood'] ? String(entry['neighborhood']) : undefined,
      arrivalOrder:
        entry['arrivalOrder'] != null && !Number.isNaN(Number(entry['arrivalOrder']))
          ? Number(entry['arrivalOrder'])
          : undefined,
      arrivedAt: entry['arrivedAt'] ? String(entry['arrivedAt']) : undefined,
    };
  }
}

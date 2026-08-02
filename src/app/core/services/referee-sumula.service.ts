import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  RefereeSumulaAthlete,
  RefereeSumulaBoard,
  RefereeSumulaStatField,
  RefereeSumulaStats,
  emptyRefereeSumulaStats,
} from '../models/referee-sumula.model';
import { isInvalidCloudFunctionError, parseErrorMessage } from '../utils/parse-error.util';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class RefereeSumulaService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async loadBoard(eventId: string): Promise<RefereeSumulaBoard> {
    try {
      const result = await Parse.Cloud.run('getRefereeSumulaBoard', { eventId });
      return this.normalizeBoard(result);
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Sumula do evento indisponivel. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async saveBoard(
    eventId: string,
    entries: Array<{ athleteUserId: string; stats: RefereeSumulaStats }>
  ): Promise<void> {
    try {
      await Parse.Cloud.run('saveRefereeSumulaBoard', { eventId, entries });
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Nao foi possivel salvar a sumula. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async incrementStat(
    eventId: string,
    athleteUserId: string,
    field: RefereeSumulaStatField,
    delta: 1 | -1
  ): Promise<RefereeSumulaStats> {
    try {
      const result = await Parse.Cloud.run('incrementRefereeSumula', {
        eventId,
        athleteUserId,
        field,
        delta,
      });
      const stats = (result as { stats?: RefereeSumulaStats })?.stats;
      return stats ? this.normalizeStats(stats) : emptyRefereeSumulaStats();
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Nao foi possivel salvar a sumula. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async saveObservation(
    eventId: string,
    athleteUserId: string,
    observation: string
  ): Promise<RefereeSumulaStats> {
    try {
      const result = await Parse.Cloud.run('saveRefereeSumulaObservation', {
        eventId,
        athleteUserId,
        observation,
      });
      const stats = (result as { stats?: RefereeSumulaStats })?.stats;
      return stats ? this.normalizeStats(stats) : emptyRefereeSumulaStats();
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Nao foi possivel salvar a observacao. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  private normalizeBoard(raw: unknown): RefereeSumulaBoard {
    const data = raw as RefereeSumulaBoard;
    const athletes = Array.isArray(data.athletes)
      ? data.athletes.map((athlete) => this.normalizeAthlete(athlete))
      : [];

    return {
      eventId: String(data.eventId || ''),
      eventName: String(data.eventName || 'Evento'),
      locked: !!data.locked,
      canEdit: data.canEdit !== undefined ? !!data.canEdit : !data.locked,
      athletes,
    };
  }

  private normalizeAthlete(athlete: RefereeSumulaAthlete): RefereeSumulaAthlete {
    return {
      userId: String(athlete.userId || ''),
      registrationId: String(athlete.registrationId || ''),
      apelido: String(athlete.apelido || athlete.userName || 'Atleta'),
      userName: String(athlete.userName || athlete.apelido || 'Atleta'),
      avatarUrl: athlete.avatarUrl ? String(athlete.avatarUrl) : undefined,
      primaryPosition: athlete.primaryPosition ? String(athlete.primaryPosition) : undefined,
      stats: this.normalizeStats(athlete.stats),
    };
  }

  private normalizeStats(raw: unknown): RefereeSumulaStats {
    const stats = (raw ?? {}) as RefereeSumulaStats;
    return {
      goals: Number(stats.goals) || 0,
      fouls: Number(stats.fouls) || 0,
      yellowCards: Number(stats.yellowCards) || 0,
      redCards: Number(stats.redCards) || 0,
      penaltiesCommitted: Number(stats.penaltiesCommitted) || 0,
      penaltiesSuffered: Number(stats.penaltiesSuffered) || 0,
      observation: stats.observation ? String(stats.observation) : '',
    };
  }
}

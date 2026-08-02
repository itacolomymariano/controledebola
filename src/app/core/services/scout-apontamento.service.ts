import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  AthleteScoutPerformanceSummary,
  ScoutApontamentoAthlete,
  ScoutApontamentoBoard,
  ScoutApontamentoStats,
  ScoutStatField,
  emptyScoutApontamentoStats,
} from '../models/scout-apontamento.model';
import { isInvalidCloudFunctionError, parseErrorMessage } from '../utils/parse-error.util';
import { AthletePerformanceService } from './athlete-performance.service';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class ScoutApontamentoService {
  constructor(
    private readonly parseService: ParseService,
    private readonly performanceService: AthletePerformanceService
  ) {
    this.parseService.init();
  }

  async loadBoard(eventId: string): Promise<ScoutApontamentoBoard> {
    try {
      const result = await Parse.Cloud.run('getScoutApontamentoBoard', { eventId });
      return this.normalizeBoard(result);
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Apontamento scout indisponivel. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async incrementStat(
    eventId: string,
    athleteUserId: string,
    field: ScoutStatField,
    delta: 1 | -1
  ): Promise<ScoutApontamentoStats> {
    try {
      const result = await Parse.Cloud.run('incrementScoutApontamento', {
        eventId,
        athleteUserId,
        field,
        delta,
      });
      const stats = (result as { stats?: ScoutApontamentoStats })?.stats;
      return stats ? this.normalizeStats(stats) : emptyScoutApontamentoStats();
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Nao foi possivel salvar o apontamento. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  private normalizeBoard(raw: unknown): ScoutApontamentoBoard {
    const data = raw as ScoutApontamentoBoard;
    const athletes = Array.isArray(data.athletes)
      ? data.athletes.map((athlete) => this.normalizeAthlete(athlete))
      : [];

    return {
      eventId: String(data.eventId || ''),
      eventName: String(data.eventName || 'Evento'),
      locked: !!data.locked,
      viewOnly: !!data.viewOnly,
      assignedAthleteUserId: data.assignedAthleteUserId
        ? String(data.assignedAthleteUserId)
        : undefined,
      canAssign: !!data.canAssign,
      athletes,
      allAthletes: Array.isArray(data.allAthletes)
        ? data.allAthletes.map((athlete) => this.normalizeAthlete(athlete))
        : athletes,
      selectableAthletes: Array.isArray(data.selectableAthletes)
        ? data.selectableAthletes.map((athlete) => this.normalizeAthlete(athlete))
        : athletes,
    };
  }

  async assignAthlete(eventId: string, athleteUserId: string): Promise<void> {
    try {
      await Parse.Cloud.run('assignScoutApontamentoAthlete', { eventId, athleteUserId });
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Nao foi possivel atribuir o atleta. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async hasSavedApontamento(eventId: string): Promise<boolean> {
    try {
      const result = (await Parse.Cloud.run('eventHasScoutApontamento', { eventId })) as {
        hasScoutApontamento?: boolean;
      };
      return !!result?.hasScoutApontamento;
    } catch {
      return false;
    }
  }

  async getAthletePerformanceSummary(athleteUserId: string): Promise<AthleteScoutPerformanceSummary> {
    try {
      const result = await Parse.Cloud.run('getAthleteScoutPerformanceSummary', { athleteUserId });
      const data = result as AthleteScoutPerformanceSummary;
      return {
        athleteUserId: String(data.athleteUserId || athleteUserId),
        totals: this.normalizeStats(data.totals),
        events: Array.isArray(data.events)
          ? data.events.map((event) => ({
              eventId: String(event.eventId || ''),
              eventName: String(event.eventName || 'Evento'),
              eventDate: event.eventDate ? String(event.eventDate) : undefined,
              stats: this.normalizeStats(event.stats),
            }))
          : [],
      };
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        throw new Error(
          'Desempenho scout indisponivel. Publique o Cloud Code atualizado no Back4App.'
        );
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  private normalizeAthlete(athlete: ScoutApontamentoAthlete): ScoutApontamentoAthlete {
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

  private normalizeStats(raw: unknown): ScoutApontamentoStats {
    return this.performanceService.normalizeStats(raw);
  }
}

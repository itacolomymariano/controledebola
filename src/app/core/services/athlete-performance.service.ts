import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  AthletePerformanceStats,
  emptyAthletePerformanceStats,
  SCOUT_STAT_FIELDS,
  ScoutStatField,
  withComputedScoutGoals,
  ALL_SCOUT_APONTAMENTO_STAT_FIELDS,
} from '../models/athlete-performance.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseService } from './parse.service';

export type PerformanceScope = 'app' | 'pelada' | 'event';

export interface AthletePerformanceDashboard {
  athleteUserId: string;
  scope: PerformanceScope;
  scopeId?: string;
  totals: AthletePerformanceStats;
  charts: {
    shotsOnTarget: number;
    shotsOffTarget: number;
    goals: number;
    shotAccuracyPct: number;
    goalConversionPct: number;
    passAccuracyPct: number;
    foulsCommitted: number;
    foulsSuffered: number;
    assists: number;
  };
}

export interface MuralPerformanceTopEntry {
  userId: string;
  total: number;
  userName?: string;
  apelido?: string;
  avatarUrl?: string;
  primaryPosition?: string;
  footPreference?: import('../models/athlete-performance.model').AthleteFootPreference;
}

export interface MuralPerformanceAnalytics {
  qualitative: {
    shotsOnTarget: MuralPerformanceTopEntry[];
    totalShots: MuralPerformanceTopEntry[];
    assists: MuralPerformanceTopEntry[];
  };
  quantitative: {
    totalShots: MuralPerformanceTopEntry[];
    passesCompleted: MuralPerformanceTopEntry[];
    foulsSuffered: MuralPerformanceTopEntry[];
    foulsCommitted: MuralPerformanceTopEntry[];
    passesMissed: MuralPerformanceTopEntry[];
  };
  charts: {
    shotsOnTarget: number;
    shotsOffTarget: number;
    goals: number;
    totalShots: number;
    totalPasses: number;
    passesCompleted: number;
    shotAccuracyPct: number;
    goalConversionPct: number;
    passAccuracyPct: number;
    foulsCommitted: number;
    athleteCount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AthletePerformanceService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async loadDashboard(
    scope: PerformanceScope,
    scopeId?: string,
    athleteUserId?: string
  ): Promise<AthletePerformanceDashboard> {
    try {
      const result = await Parse.Cloud.run('getAthletePerformanceDashboard', {
        scope,
        scopeId,
        athleteUserId,
      });
      return this.normalizeDashboard(result);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async loadMuralAnalytics(
    scope: PerformanceScope,
    scopeId?: string
  ): Promise<MuralPerformanceAnalytics> {
    try {
      const result = await Parse.Cloud.run('getMuralPerformanceAnalytics', { scope, scopeId });
      return this.normalizeMuralAnalytics(result);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async registerScoutPenalty(
    eventId: string,
    committedUserId: string,
    sufferedUserId: string
  ): Promise<void> {
    try {
      await Parse.Cloud.run('registerScoutPenalty', {
        eventId,
        committedUserId,
        sufferedUserId,
      });
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async registerRefereePenalty(
    eventId: string,
    committedUserId: string,
    sufferedUserId: string
  ): Promise<void> {
    try {
      await Parse.Cloud.run('registerRefereePenalty', {
        eventId,
        committedUserId,
        sufferedUserId,
      });
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  normalizeStats(raw: unknown): AthletePerformanceStats {
    const stats = (raw ?? {}) as Partial<AthletePerformanceStats>;
    const result = emptyAthletePerformanceStats();
    for (const field of ALL_SCOUT_APONTAMENTO_STAT_FIELDS) {
      result[field] = Number(stats[field as ScoutStatField]) || 0;
    }
    return withComputedScoutGoals(result);
  }

  private normalizeDashboard(raw: unknown): AthletePerformanceDashboard {
    const data = raw as AthletePerformanceDashboard;
    return {
      athleteUserId: String(data.athleteUserId || ''),
      scope: (data.scope as PerformanceScope) || 'app',
      scopeId: data.scopeId ? String(data.scopeId) : undefined,
      totals: this.normalizeStats(data.totals),
      charts: {
        shotsOnTarget: Number(data.charts?.shotsOnTarget) || 0,
        shotsOffTarget: Number(data.charts?.shotsOffTarget) || 0,
        goals: Number(data.charts?.goals) || 0,
        shotAccuracyPct: Number(data.charts?.shotAccuracyPct) || 0,
        goalConversionPct: Number(data.charts?.goalConversionPct) || 0,
        passAccuracyPct: Number(data.charts?.passAccuracyPct) || 0,
        foulsCommitted: Number(data.charts?.foulsCommitted) || 0,
        foulsSuffered: Number(data.charts?.foulsSuffered) || 0,
        assists: Number(data.charts?.assists) || 0,
      },
    };
  }

  private normalizeTopEntries(raw: unknown): MuralPerformanceTopEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => ({
      userId: String(row.userId || ''),
      total: Number(row.total) || 0,
      userName: row.userName ? String(row.userName) : undefined,
      apelido: row.apelido ? String(row.apelido) : undefined,
      avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
      primaryPosition: row.primaryPosition ? String(row.primaryPosition) : undefined,
      footPreference: row.footPreference ? row.footPreference : undefined,
    }));
  }

  normalizeMuralAnalytics(raw: unknown): MuralPerformanceAnalytics {
    const data = raw as MuralPerformanceAnalytics;
    return {
      qualitative: {
        shotsOnTarget: this.normalizeTopEntries(data.qualitative?.shotsOnTarget),
        totalShots: this.normalizeTopEntries(data.qualitative?.totalShots),
        assists: this.normalizeTopEntries(data.qualitative?.assists),
      },
      quantitative: {
        totalShots: this.normalizeTopEntries(data.quantitative?.totalShots),
        passesCompleted: this.normalizeTopEntries(data.quantitative?.passesCompleted),
        foulsSuffered: this.normalizeTopEntries(data.quantitative?.foulsSuffered),
        foulsCommitted: this.normalizeTopEntries(data.quantitative?.foulsCommitted),
        passesMissed: this.normalizeTopEntries(data.quantitative?.passesMissed),
      },
      charts: {
        shotsOnTarget: Number(data.charts?.shotsOnTarget) || 0,
        shotsOffTarget: Number(data.charts?.shotsOffTarget) || 0,
        goals: Number(data.charts?.goals) || 0,
        totalShots: Number(data.charts?.totalShots) || 0,
        totalPasses: Number(data.charts?.totalPasses) || 0,
        passesCompleted: Number(data.charts?.passesCompleted) || 0,
        shotAccuracyPct: Number(data.charts?.shotAccuracyPct) || 0,
        goalConversionPct: Number(data.charts?.goalConversionPct) || 0,
        passAccuracyPct: Number(data.charts?.passAccuracyPct) || 0,
        foulsCommitted: Number(data.charts?.foulsCommitted) || 0,
        athleteCount: Number(data.charts?.athleteCount) || 0,
      },
    };
  }
}

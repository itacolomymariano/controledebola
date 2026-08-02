import {
  AthletePerformanceStats,
  REFEREE_SUMULA_STAT_FIELDS,
  REFEREE_SUMULA_STAT_LABELS,
  emptyAthletePerformanceStats,
} from './athlete-performance.model';

export {
  REFEREE_SUMULA_STAT_FIELDS,
  REFEREE_SUMULA_STAT_LABELS,
  emptyRefereeSumulaStatsExtended as emptyRefereeSumulaStats,
};

export type RefereeSumulaStatField = import('./athlete-performance.model').RefereeSumulaStatField;

export interface RefereeSumulaStats extends Pick<
  AthletePerformanceStats,
  'goals' | 'yellowCards' | 'redCards' | 'penaltiesCommitted' | 'penaltiesSuffered'
> {
  fouls: number;
  observation: string;
}

export interface RefereeSumulaAthlete {
  userId: string;
  registrationId: string;
  apelido: string;
  userName: string;
  avatarUrl?: string;
  primaryPosition?: string;
  stats: RefereeSumulaStats;
}

export interface RefereeSumulaBoard {
  eventId: string;
  eventName: string;
  locked: boolean;
  canEdit?: boolean;
  athletes: RefereeSumulaAthlete[];
}

export function emptyRefereeSumulaStatsExtended(): RefereeSumulaStats {
  const base = emptyAthletePerformanceStats();
  return {
    goals: base.goals,
    fouls: base.foulsCommitted,
    yellowCards: base.yellowCards,
    redCards: base.redCards,
    penaltiesCommitted: base.penaltiesCommitted,
    penaltiesSuffered: base.penaltiesSuffered,
    observation: '',
  };
}

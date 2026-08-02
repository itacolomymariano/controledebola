export {
  AthletePerformanceStats as ScoutApontamentoStats,
  SCOUT_STAT_FIELDS,
  SCOUT_STAT_LABELS,
  SCOUT_STAT_GROUPS,
  SCOUT_GOALKEEPER_STAT_GROUPS,
  SCOUT_GENERAL_STAT_FIELDS,
  SCOUT_GENERAL_STAT_LABELS,
  SCOUT_GOAL_TYPE_FIELDS,
  SCOUT_GOAL_METHOD_OPTIONS,
  SCOUT_MANUAL_STAT_FIELDS,
  PENALTY_STAT_FIELDS,
  emptyAthletePerformanceStats as emptyScoutApontamentoStats,
  computeScoutGoalsTotal,
  withComputedScoutGoals,
  withComputedScoutDerivedStats,
  isGoalkeeperPosition,
  type ScoutStatField,
} from './athlete-performance.model';

export interface ScoutApontamentoAthlete {
  userId: string;
  registrationId: string;
  apelido: string;
  userName: string;
  avatarUrl?: string;
  primaryPosition?: string;
  stats: import('./athlete-performance.model').AthletePerformanceStats;
}

export interface ScoutApontamentoBoard {
  eventId: string;
  eventName: string;
  locked: boolean;
  viewOnly?: boolean;
  assignedAthleteUserId?: string;
  canAssign?: boolean;
  athletes: ScoutApontamentoAthlete[];
  allAthletes?: ScoutApontamentoAthlete[];
  selectableAthletes?: ScoutApontamentoAthlete[];
}

export interface AthleteScoutPerformanceEventSummary {
  eventId: string;
  eventName: string;
  eventDate?: string;
  stats: import('./athlete-performance.model').AthletePerformanceStats;
}

export interface AthleteScoutPerformanceSummary {
  athleteUserId: string;
  totals: import('./athlete-performance.model').AthletePerformanceStats;
  events: AthleteScoutPerformanceEventSummary[];
}

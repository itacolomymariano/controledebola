/** Shared athlete performance counters used in scout apontamento, sumula and desempenho. */

export type AthleteFootPreference = 'destro' | 'ambidestro' | 'canhoto';

export const ATHLETE_FOOT_OPTIONS: Array<{ value: AthleteFootPreference; label: string }> = [
  { value: 'destro', label: 'Destro' },
  { value: 'ambidestro', label: 'Ambidestro' },
  { value: 'canhoto', label: 'Canhoto' },
];

export const ATHLETE_FOOT_LABELS: Record<AthleteFootPreference, string> = {
  destro: 'Destro',
  ambidestro: 'Ambidestro',
  canhoto: 'Canhoto',
};

export type AthletePersonalStatsConflictSource = 'personal_scout' | 'referee' | 'event_scout';

export const ATHLETE_PERSONAL_STATS_CONFLICT_OPTIONS: Array<{
  value: AthletePersonalStatsConflictSource;
  label: string;
}> = [
  { value: 'personal_scout', label: 'Personal scout' },
  { value: 'referee', label: 'Juiz / Arbitro' },
  { value: 'event_scout', label: 'Scout do evento' },
];

export type ScoutStatField =
  | 'shotsOffTarget'
  | 'shotsOnTarget'
  | 'foulsCommitted'
  | 'foulsCommittedGame'
  | 'foulsCommittedPenalty'
  | 'foulsSuffered'
  | 'foulsSufferedGame'
  | 'foulsSufferedPenalty'
  | 'goals'
  | 'ownGoals'
  | 'assists'
  | 'passesCompleted'
  | 'passesMissed'
  | 'yellowCards'
  | 'redCards'
  | 'goalsHeader'
  | 'goalsFreeKick'
  | 'goalsRightFoot'
  | 'goalsLeftFoot'
  | 'goalsOlympic'
  | 'goalsCrazy'
  | 'goalsPenalty'
  | 'penaltiesCommitted'
  | 'penaltiesSuffered'
  | 'saves'
  | 'savesPenalty'
  | 'savesFreeKick'
  | 'savesOpenPlay'
  | 'goalsConceded'
  | 'goalsConcededPenalty'
  | 'goalsConcededFreeKick'
  | 'goalsConcededOpenPlay'
  | 'gkAssistsHand'
  | 'gkAssistsFeet';

export interface AthletePerformanceStats {
  shotsOffTarget: number;
  shotsOnTarget: number;
  foulsCommitted: number;
  foulsCommittedGame: number;
  foulsCommittedPenalty: number;
  foulsSuffered: number;
  foulsSufferedGame: number;
  foulsSufferedPenalty: number;
  goals: number;
  ownGoals: number;
  assists: number;
  passesCompleted: number;
  passesMissed: number;
  yellowCards: number;
  redCards: number;
  goalsHeader: number;
  goalsFreeKick: number;
  goalsRightFoot: number;
  goalsLeftFoot: number;
  goalsOlympic: number;
  goalsCrazy: number;
  goalsPenalty: number;
  penaltiesCommitted: number;
  penaltiesSuffered: number;
  saves: number;
  savesPenalty: number;
  savesFreeKick: number;
  savesOpenPlay: number;
  goalsConceded: number;
  goalsConcededPenalty: number;
  goalsConcededFreeKick: number;
  goalsConcededOpenPlay: number;
  gkAssistsHand: number;
  gkAssistsFeet: number;
}

export const SCOUT_BASE_STAT_FIELDS: ScoutStatField[] = [
  'shotsOffTarget',
  'shotsOnTarget',
  'foulsCommitted',
  'foulsSuffered',
  'goals',
  'ownGoals',
  'assists',
  'passesCompleted',
  'passesMissed',
  'yellowCards',
  'redCards',
];

export const SCOUT_GOAL_TYPE_FIELDS: ScoutStatField[] = [
  'goalsHeader',
  'goalsFreeKick',
  'goalsRightFoot',
  'goalsLeftFoot',
  'goalsOlympic',
  'goalsCrazy',
  'goalsPenalty',
];

export const SCOUT_GOAL_METHOD_OPTIONS: Array<{ field: ScoutStatField; label: string }> = [
  { field: 'goalsHeader', label: 'De cabeca' },
  { field: 'goalsFreeKick', label: 'De falta' },
  { field: 'goalsRightFoot', label: 'De pe direito' },
  { field: 'goalsLeftFoot', label: 'De pe esquerdo' },
  { field: 'goalsOlympic', label: 'Gol olimpico' },
  { field: 'goalsCrazy', label: 'Gol maluco' },
  { field: 'goalsPenalty', label: 'Gol de penalti' },
];

export const PENALTY_STAT_FIELDS: ScoutStatField[] = ['penaltiesCommitted', 'penaltiesSuffered'];

export const SCOUT_FOUL_BREAKDOWN_FIELDS: ScoutStatField[] = [
  'foulsCommittedGame',
  'foulsCommittedPenalty',
  'foulsSufferedGame',
  'foulsSufferedPenalty',
];

export const SCOUT_GOALKEEPER_BREAKDOWN_FIELDS: ScoutStatField[] = [
  'savesPenalty',
  'savesFreeKick',
  'savesOpenPlay',
  'goalsConcededPenalty',
  'goalsConcededFreeKick',
  'goalsConcededOpenPlay',
  'gkAssistsHand',
  'gkAssistsFeet',
];

/** Campos editaveis no apontamento (tipos de gol sao registrados um por vez via picker). */
export const SCOUT_MANUAL_STAT_FIELDS: ScoutStatField[] = [
  'shotsOffTarget',
  'shotsOnTarget',
  ...SCOUT_FOUL_BREAKDOWN_FIELDS,
  'ownGoals',
  'assists',
  'passesCompleted',
  'passesMissed',
  'yellowCards',
  'redCards',
  ...PENALTY_STAT_FIELDS,
  ...SCOUT_GOALKEEPER_BREAKDOWN_FIELDS,
];

export const SCOUT_STAT_FIELDS: ScoutStatField[] = ['goals', ...SCOUT_MANUAL_STAT_FIELDS];

/** Todos os campos retornados pelo apontamento scout (inclui tipos de gol). */
export const ALL_SCOUT_APONTAMENTO_STAT_FIELDS: ScoutStatField[] = [
  'goals',
  ...SCOUT_MANUAL_STAT_FIELDS,
  ...SCOUT_GOAL_TYPE_FIELDS,
];

export const SCOUT_STAT_LABELS: Record<ScoutStatField, string> = {
  shotsOffTarget: 'Finalizacao fora',
  shotsOnTarget: 'Finalizacao alvo',
  foulsCommitted: 'Faltas cometidas (total)',
  foulsCommittedGame: 'Falta cometida de jogo',
  foulsCommittedPenalty: 'Falta cometida de penalti',
  foulsSuffered: 'Faltas sofridas (total)',
  foulsSufferedGame: 'Falta sofrida de jogo',
  foulsSufferedPenalty: 'Falta sofrida de penalti',
  goals: 'Gol a favor',
  ownGoals: 'Gol contra',
  assists: 'Assistencia',
  passesCompleted: 'Passe certo',
  passesMissed: 'Passe errado',
  yellowCards: 'Amarelo',
  redCards: 'Vermelho',
  goalsHeader: 'Gol de cabeca',
  goalsFreeKick: 'Gol de falta',
  goalsRightFoot: 'Gol pe direito',
  goalsLeftFoot: 'Gol pe esquerdo',
  goalsOlympic: 'Gol olimpico',
  goalsCrazy: 'Gol maluco',
  goalsPenalty: 'Gol de penalti',
  penaltiesCommitted: 'Penalti cometido',
  penaltiesSuffered: 'Penalti sofrido',
  saves: 'Defesas (total)',
  savesPenalty: 'Defesa de penalti',
  savesFreeKick: 'Defesa de falta',
  savesOpenPlay: 'Defesa de jogo corrido',
  goalsConceded: 'Gols sofridos (total)',
  goalsConcededPenalty: 'Gol sofrido de penalti',
  goalsConcededFreeKick: 'Gol sofrido de falta',
  goalsConcededOpenPlay: 'Gol sofrido de jogo corrido',
  gkAssistsHand: 'Assistencia com a mao',
  gkAssistsFeet: 'Assistencia com os pes',
};

export const SCOUT_STAT_GROUPS: Array<{ title: string; fields: ScoutStatField[] }> = [
  {
    title: 'Ataque',
    fields: ['shotsOffTarget', 'shotsOnTarget', 'ownGoals', 'assists'],
  },
  {
    title: 'Gols a favor',
    fields: ['goals'],
  },
  {
    title: 'Passes',
    fields: ['passesCompleted', 'passesMissed'],
  },
  {
    title: 'Disciplina',
    fields: [
      'foulsCommitted',
      ...SCOUT_FOUL_BREAKDOWN_FIELDS,
      'foulsSuffered',
      'yellowCards',
      'redCards',
      ...PENALTY_STAT_FIELDS,
    ],
  },
];

export const SCOUT_GOALKEEPER_STAT_GROUPS: Array<{ title: string; fields: ScoutStatField[] }> = [
  {
    title: 'Defesas',
    fields: ['saves', 'savesPenalty', 'savesFreeKick', 'savesOpenPlay'],
  },
  {
    title: 'Gols sofridos',
    fields: ['goalsConceded', 'goalsConcededPenalty', 'goalsConcededFreeKick', 'goalsConcededOpenPlay'],
  },
  {
    title: 'Assistencias do goleiro',
    fields: ['gkAssistsHand', 'gkAssistsFeet'],
  },
];

export const SCOUT_GENERAL_STAT_FIELDS: ScoutStatField[] = SCOUT_MANUAL_STAT_FIELDS;

export const SCOUT_GENERAL_STAT_LABELS = SCOUT_STAT_LABELS;

export type RefereeSumulaStatField =
  | 'goals'
  | 'foulsCommitted'
  | 'yellowCards'
  | 'redCards'
  | 'penaltiesCommitted'
  | 'penaltiesSuffered';

export const REFEREE_SUMULA_STAT_FIELDS: RefereeSumulaStatField[] = [
  'goals',
  'foulsCommitted',
  'yellowCards',
  'redCards',
  'penaltiesCommitted',
  'penaltiesSuffered',
];

export const REFEREE_SUMULA_STAT_LABELS: Record<RefereeSumulaStatField, string> = {
  goals: 'Gol',
  foulsCommitted: 'Falta',
  yellowCards: 'Cartao amarelo',
  redCards: 'Cartao vermelho',
  penaltiesCommitted: 'Penalti cometido',
  penaltiesSuffered: 'Penalti sofrido',
};

export function emptyAthletePerformanceStats(): AthletePerformanceStats {
  return {
    shotsOffTarget: 0,
    shotsOnTarget: 0,
    foulsCommitted: 0,
    foulsCommittedGame: 0,
    foulsCommittedPenalty: 0,
    foulsSuffered: 0,
    foulsSufferedGame: 0,
    foulsSufferedPenalty: 0,
    goals: 0,
    ownGoals: 0,
    assists: 0,
    passesCompleted: 0,
    passesMissed: 0,
    yellowCards: 0,
    redCards: 0,
    goalsHeader: 0,
    goalsFreeKick: 0,
    goalsRightFoot: 0,
    goalsLeftFoot: 0,
    goalsOlympic: 0,
    goalsCrazy: 0,
    goalsPenalty: 0,
    penaltiesCommitted: 0,
    penaltiesSuffered: 0,
    saves: 0,
    savesPenalty: 0,
    savesFreeKick: 0,
    savesOpenPlay: 0,
    goalsConceded: 0,
    goalsConcededPenalty: 0,
    goalsConcededFreeKick: 0,
    goalsConcededOpenPlay: 0,
    gkAssistsHand: 0,
    gkAssistsFeet: 0,
  };
}

export function isGoalkeeperPosition(position?: string | null): boolean {
  return String(position || '')
    .trim()
    .toLowerCase() === 'goleiro';
}

export function withComputedScoutDerivedStats(stats: AthletePerformanceStats): AthletePerformanceStats {
  const foulsCommitted = stats.foulsCommittedGame + stats.foulsCommittedPenalty;
  const foulsSuffered = stats.foulsSufferedGame + stats.foulsSufferedPenalty;
  const saves = stats.savesPenalty + stats.savesFreeKick + stats.savesOpenPlay;
  const goalsConceded =
    stats.goalsConcededPenalty + stats.goalsConcededFreeKick + stats.goalsConcededOpenPlay;
  const gkAssists = stats.gkAssistsHand + stats.gkAssistsFeet;
  return {
    ...withComputedScoutGoals(stats),
    foulsCommitted,
    foulsSuffered,
    saves,
    goalsConceded,
    assists: gkAssists > 0 ? Math.max(stats.assists, gkAssists) : stats.assists,
  };
}

export function computeScoutGoalsTotal(
  stats: Pick<AthletePerformanceStats, ScoutStatField | 'goals'>
): number {
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(stats[field] || 0);
  }
  return total;
}

export function withComputedScoutGoals(stats: AthletePerformanceStats): AthletePerformanceStats {
  return { ...stats, goals: computeScoutGoalsTotal(stats) };
}

export function formatFootPreference(value?: AthleteFootPreference | string): string {
  if (value === 'destro' || value === 'ambidestro' || value === 'canhoto') {
    return ATHLETE_FOOT_LABELS[value];
  }
  return '';
}

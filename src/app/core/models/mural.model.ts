import { MuralTargetRole } from './event-performance.model';
import { Address } from './address.model';
import { ProfileRole } from './profile-role.model';
import { PeladaParticipant } from './pelada-participant.model';
import { MuralLocationTopRankings } from './mural-location-top.model';
import { MuralParticipantLocationStats } from './mural-participant-stats.model';

export type MuralScope = 'app' | 'pelada' | 'event';

/** Nivel do drill-down de regiao no mural do app. */
export type MuralLocationLevel = 'state' | 'city' | 'neighborhood';

/** Opcao de regiao com contagem (ex.: Campinas (12)). */
export interface MuralLocationOption {
  key: string;
  label: string;
  count: number;
}

/** Filtro de regiao em cascata aplicado as tres abas do mural do app. */
export interface MuralLocationFilter {
  state?: string;
  city?: string;
  neighborhood?: string;
}

export interface MuralVote {
  objectId: string;
  scope: MuralScope;
  scopeId?: string;
  voterId: string;
  targetUserId: string;
  targetUserName: string;
  targetRole: MuralTargetRole;
  score: number;
  period: string;
  createdAt: Date;
  targetAvatarUrl?: string;
}

export interface MuralRankingEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  role: MuralTargetRole;
  totalScore: number;
  voteCount: number;
  averageScore: number;
  performanceScore: number;
  combinedScore: number;
  /** Sort key ponderado (ex.: confronto 3x); nao exibir no card. */
  rankingScore?: number;
  /** Avaliadores distintos (mural app, anticorrupcao). */
  distinctVoterCount?: number;
}

export interface CreateMuralVotePayload {
  scope: MuralScope;
  scopeId?: string;
  targetUserId: string;
  targetRole: MuralTargetRole;
  score: number;
  period: string;
}

export interface EventMuralVoteSummary {
  totalVotes: number;
  voterCount: number;
  totalParticipants: number;
  votePercentage: number;
  voterQuorumMet?: boolean;
  minVoters?: number;
}

export interface EventMuralDashboard {
  rankings: Record<MuralTargetRole, MuralRankingEntry[]>;
  voteSummary: EventMuralVoteSummary;
  participants?: Array<{
    userId: string;
    userName: string;
    apelido: string;
    fullName?: string;
    roles: ProfileRole[];
    avatarUrl?: string;
    birthDate?: string;
    address?: Address;
    proFootballIdol?: string;
    amateurFootballIdol?: string;
  }>;
  locationStats?: {
    total: number;
    byState: Array<{ label: string; count: number }>;
    byCity: Array<{ label: string; count: number }>;
    byNeighborhood: Array<{ label: string; count: number }>;
  };
  myVotes?: MuralVote[];
  cloudAvailable: boolean;
}

export interface MuralVoteAggregateEntry {
  totalScore: number;
  /** Sort key ponderado (confronto 3x); cards usam totalScore. */
  rankingScore?: number;
  voteCount: number;
  userName: string;
}

export type MuralVoteAggregates = Record<MuralTargetRole, Record<string, MuralVoteAggregateEntry>>;

export interface CastEventMuralVotePayload {
  eventId: string;
  registrationId: string;
  targetRole: MuralTargetRole;
  score: number;
  period: string;
}

export interface MuralAppPredictionEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  totalScore: number;
  eventsCount: number;
}

export interface MuralTeamMatchRecordHighlight {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRatePercent: number;
  shieldImageUrl?: string;
  presidentId?: string;
  presidentName?: string;
  presidentAvatarUrl?: string;
  foundedAt?: string | null;
  homeVenue?: string;
}

/** Treinador no Top 10 de confrontos (V/E/D + metadados). */
export interface MuralCoachRankEntry extends MuralRankingEntry {
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  winRatePercent?: number;
  teamsCoachedCount?: number;
  age?: number;
}

export interface MuralTeamMatchLocationBucket {
  label: string;
  count: number;
}

export interface MuralTeamMatchPerformanceTopEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  total: number;
}

/** Melhor time do app: mais confrontos, desempate pelo aproveitamento. */
export interface MuralTeamMatchBestTeam {
  teamId: string;
  teamName: string;
  shieldImageUrl?: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  winRatePercent: number;
}

/** Sequencia invicta mais longa (da partida mais recente para tras). */
export interface MuralTeamMatchUnbeatenStreak {
  teamId: string;
  teamName: string;
  shieldImageUrl?: string;
  unbeatenDays: number;
  unbeatenLabel: string;
  matchesInStreak: number;
  sinceStartTime?: string | null;
}

export interface MuralTeamMatchTopScorer {
  userId: string;
  name: string;
  avatarUrl?: string;
  goals: number;
  goalsPerMatch: number;
}

export interface MuralTeamMatchTopDefender {
  userId: string;
  name: string;
  avatarUrl?: string;
  points: number;
  pointsPerMatch: number;
}

export interface MuralTeamMatchBestAttack {
  teamId: string;
  teamName: string;
  shieldImageUrl?: string;
  goalsFor: number;
  matchesPlayed: number;
  goalsPerMatch: number;
  topScorer: MuralTeamMatchTopScorer | null;
}

export interface MuralTeamMatchBestDefense {
  teamId: string;
  teamName: string;
  shieldImageUrl?: string;
  goalsAgainst: number;
  matchesPlayed: number;
  goalsAgainstPerMatch: number;
  topDefender: MuralTeamMatchTopDefender | null;
}

export interface MuralTeamMatchDashboard {
  totalConfrontos: number;
  locationStats: {
    byState: MuralTeamMatchLocationBucket[];
    byCity: MuralTeamMatchLocationBucket[];
    byNeighborhood: MuralTeamMatchLocationBucket[];
  };
  teamHighlights: {
    mostMatches: MuralTeamMatchRecordHighlight | null;
    mostWins: MuralTeamMatchRecordHighlight | null;
    mostLosses: MuralTeamMatchRecordHighlight | null;
    mostDraws: MuralTeamMatchRecordHighlight | null;
    bestWinRate: MuralTeamMatchRecordHighlight | null;
  };
  topAthletes: MuralRankingEntry[];
  topGoalkeepers: MuralRankingEntry[];
  topReferees: MuralRankingEntry[];
  topScorers: MuralTeamMatchPerformanceTopEntry[];
  topAssists: MuralTeamMatchPerformanceTopEntry[];
  topPasses: MuralTeamMatchPerformanceTopEntry[];
  topTeams?: MuralAppTeamRankEntry[];
  topCoaches?: MuralCoachRankEntry[];
  /** Regiao efetivamente aplicada pela Cloud (ausente em Cloud antigo). */
  appliedLocation?: MuralLocationFilter;
  /** Cards de destaque da aba Confrontos — opcionais (Cloud antigo nao envia). */
  bestTeam?: MuralTeamMatchBestTeam | null;
  longestUnbeaten?: MuralTeamMatchUnbeatenStreak | null;
  bestAttack?: MuralTeamMatchBestAttack | null;
  bestDefense?: MuralTeamMatchBestDefense | null;
  cloudAvailable: boolean;
}

export type MuralAppBucketKey = 'merged' | 'pelada' | 'team_match';

export interface MuralAppTeamRankEntry extends MuralTeamMatchRecordHighlight {
  combinedScore?: number;
  totalScore?: number;
}

/** Pelada no ranking do Mural do App. Campos opcionais: Cloud antigo pode omitir o objeto. */
export interface MuralAppPeladaRankEntry {
  peladaId: string;
  name: string;
  place?: string;
  imageUrl?: string;
  adminId?: string;
  adminName?: string;
  adminAvatarUrl?: string;
  createdAt?: string;
  eventsHeld: number;
  filledCardsAverage: number;
  distinctProfilesAverage: number;
  participantsAverage: number;
  distinctVotersAverage: number;
  votesAverage: number;
  redCardsAverage: number;
  yellowCardsAverage: number;
  hasCash: boolean;
  hasCotinha: boolean;
  hasMailbox: boolean;
}

export interface MuralAppBucketPayload {
  bucket: MuralAppBucketKey | string;
  rankings: Record<MuralTargetRole, MuralRankingEntry[]>;
  voteAggregates: MuralVoteAggregates;
  topScorers: MuralRankingEntry[];
  topTeams: MuralAppTeamRankEntry[];
  topCoaches: MuralCoachRankEntry[];
  predictionRankings: MuralAppPredictionEntry[];
  /** Primeira do Top 10. Ausente no Cloud antigo. */
  bestPelada?: MuralAppPeladaRankEntry | null;
  /** Até 10. Ausente no Cloud antigo. Só buckets pelada e merged. */
  topPeladas?: MuralAppPeladaRankEntry[];
}

export interface MuralAppDashboard {
  participants: PeladaParticipant[];
  rankings: Record<MuralTargetRole, MuralRankingEntry[]>;
  rankingsPelada?: Record<MuralTargetRole, MuralRankingEntry[]>;
  rankingsTeamMatch?: Record<MuralTargetRole, MuralRankingEntry[]>;
  voteAggregates: MuralVoteAggregates;
  voteAggregatesPelada?: MuralVoteAggregates;
  voteAggregatesTeamMatch?: MuralVoteAggregates;
  buckets?: Partial<Record<MuralAppBucketKey, MuralAppBucketPayload>>;
  rankingsMeta?: { tieBreak: string; confrontoWeight: number };
  locationStats: MuralParticipantLocationStats;
  locationTopRankings: MuralLocationTopRankings;
  performanceAnalytics: Record<string, unknown> | null;
  predictionRankings: MuralAppPredictionEntry[];
  /** Regiao efetivamente aplicada pela Cloud (ausente em Cloud antigo). */
  appliedLocation?: MuralLocationFilter;
  cloudAvailable: boolean;
}

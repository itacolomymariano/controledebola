export interface AthleteSearchResult {
  userId: string;
  displayName: string;
  apelido?: string;
  fullName?: string;
  primaryPosition: string;
  city?: string;
  state?: string;
  avatarUrl?: string;
  /** AthleteProfile.height, em centimetros. */
  heightCm?: number;
  /** AthleteProfile.weight, em quilogramas. */
  weightKg?: number;
}

export interface SumulaObservationEntry {
  eventId: string;
  eventName: string;
  peladaName?: string;
  eventDate?: string;
  observation: string;
  yellowCards?: number;
  redCards?: number;
}

export interface AthletePublicProfile {
  userId: string;
  displayName: string;
  apelido?: string;
  fullName?: string;
  avatarUrl?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  age?: number;
  peladas: string[];
  teams: string[];
  favoriteProTeam?: string;
  favoriteAmateurTeam?: string;
  goals: number;
  yellowCards: number;
  redCards: number;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
  craquePeladas: string[];
  phone?: string;
  email?: string;
  phoneVisible?: boolean;
  emailVisible?: boolean;
  peladaRate?: number;
  teamMatchRate?: number;
  primaryPosition: string;
  /** AthleteProfile.height, em centimetros. */
  heightCm?: number;
  /** AthleteProfile.weight, em quilogramas. */
  weightKg?: number;
  sumulaObservations?: SumulaObservationEntry[];
}

/** Indicadores dos ultimos N meses (padrao 3). */
export interface TeamMatchRecord {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRatePercent: number;
  teamsPresided?: number;
}

export interface AthleteActivityIndicators {
  windowStart: string;
  windowEnd: string;
  months: number;
  gamesPlayed: number;
  peladasPlayed: number;
  gamesAbsent: number;
  peladasAbsent: number;
  teamMatchInvitesReceived: number;
  teamMatchInvitesDeclined: number;
  peladaInvitesReceived: number;
  peladaInvitesDeclined: number;
}

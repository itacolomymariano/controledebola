export interface AthleteSearchResult {
  userId: string;
  displayName: string;
  apelido?: string;
  fullName?: string;
  primaryPosition: string;
  city?: string;
  state?: string;
  avatarUrl?: string;
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
}

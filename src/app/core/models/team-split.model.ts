import { AthleteFootPreference, AthleteMaritalStatus } from './athlete-profile.model';

export interface TeamSplitAthlete {
  userId: string;
  registrationId: string;
  apelido: string;
  userName: string;
  avatarUrl?: string;
  primaryPosition?: string;
  age?: number;
  accumulatedPoints: number; /** Media de votos nos eventos da pelada */
  membershipType: 'socio' | 'convidado';
  isSocio: boolean;
  maritalStatus?: AthleteMaritalStatus;
  footPreference?: AthleteFootPreference;
  favoriteProTeam?: string;
  neighborhood?: string;
  arrivalOrder?: number;
  arrivedAt?: string;
}

export type TeamSplitMode = 'manual' | 'random';

export type TeamSplitRandomStrategy =
  | 'default'
  | 'marital'
  | 'favoriteTeam'
  | 'neighborhood';

export interface TeamSplitPositionGroup {
  position: string;
  athletes: TeamSplitAthlete[];
}

export interface EventTeamSplitState {
  athletesPerTeam: number;
  teamCount: number;
  splitMode: TeamSplitMode;
  randomStrategy?: TeamSplitRandomStrategy;
  teams: string[][];
  savedAt?: string;
}

export interface SaveEventTeamSplitPayload {
  eventId: string;
  athletesPerTeam: number;
  teamCount: number;
  splitMode: TeamSplitMode;
  randomStrategy?: TeamSplitRandomStrategy;
  teams: string[][];
}

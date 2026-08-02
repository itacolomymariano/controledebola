import { Address } from './address.model';

export type LegendAthleteRelationship =
  | 'pai'
  | 'filho'
  | 'irmao'
  | 'amigo'
  | 'admirador';

export type LegendTeamRelationship =
  | 'ex_atleta'
  | 'presidente'
  | 'diretor'
  | 'torcedor'
  | 'amigo'
  | 'admirador';

export type LegendAthleteRefType = 'app_athlete' | 'legend_athlete';

export interface LegendAthleteRef {
  type: LegendAthleteRefType;
  id: string;
  label: string;
}

export interface AmateurLegendAthlete {
  id: string;
  name: string;
  apelido: string;
  imageUrl?: string;
  address?: Address;
  birthDate?: string;
  careerEndYear?: number;
  amateurTeams: string[];
  position?: string;
  inMemoriam: boolean;
  memorialDate?: string;
  relationship: LegendAthleteRelationship;
  registeredByUserId?: string;
  registeredByName?: string;
  registeredAt?: string;
}

export interface AmateurLegendTeam {
  id: string;
  name: string;
  apelido: string;
  imageUrl?: string;
  location?: Address;
  foundedDate?: string;
  endedDate?: string;
  description?: string;
  relationship: LegendTeamRelationship;
  athleteRefs: LegendAthleteRef[];
  registeredByUserId?: string;
  registeredByName?: string;
  registeredAt?: string;
}

export interface ProLegendAthlete {
  id: string;
  name: string;
  apelido: string;
  imageUrl?: string;
  address?: Address;
  birthDate?: string;
  careerEndYear?: number;
  proTeams: string[];
  position?: string;
  inMemoriam: boolean;
  memorialDate?: string;
  relationship: LegendAthleteRelationship;
  registeredByUserId?: string;
  registeredByName?: string;
  registeredAt?: string;
}

export interface LegendSuggestion {
  id: string;
  label: string;
  subtitle?: string;
  source:
    | 'legend_athlete'
    | 'legend_pro_athlete'
    | 'app_athlete'
    | 'legend_team'
    | 'app_team'
    | 'pelada_team_text';
  imageUrl?: string;
}

export const LEGEND_ATHLETE_RELATIONSHIP_OPTIONS: Array<{
  value: LegendAthleteRelationship;
  label: string;
}> = [
  { value: 'pai', label: 'Pai' },
  { value: 'filho', label: 'Filho(a)' },
  { value: 'irmao', label: 'Irmao(a)' },
  { value: 'amigo', label: 'Amigo(a)' },
  { value: 'admirador', label: 'Admirador(a)' },
];

export const LEGEND_TEAM_RELATIONSHIP_OPTIONS: Array<{
  value: LegendTeamRelationship;
  label: string;
}> = [
  { value: 'ex_atleta', label: 'Ex-atleta' },
  { value: 'presidente', label: 'Presidente(a)' },
  { value: 'diretor', label: 'Diretor(a)' },
  { value: 'torcedor', label: 'Torcedor(a)' },
  { value: 'amigo', label: 'Amigo(a)' },
  { value: 'admirador', label: 'Admirador(a)' },
];

export interface CreateLegendAthletePayload {
  name: string;
  apelido: string;
  imageFile?: File;
  address?: Address;
  birthDate?: string;
  careerEndYear?: number;
  amateurTeams: string[];
  position?: string;
  inMemoriam: boolean;
  memorialDate?: string;
  relationship: LegendAthleteRelationship;
}

export interface CreateProLegendAthletePayload {
  name: string;
  apelido: string;
  imageFile?: File;
  address?: Address;
  birthDate?: string;
  careerEndYear?: number;
  proTeams: string[];
  position?: string;
  inMemoriam: boolean;
  memorialDate?: string;
  relationship: LegendAthleteRelationship;
}

export interface CreateLegendTeamPayload {
  name: string;
  apelido: string;
  imageFile?: File;
  location?: Address;
  foundedDate?: string;
  endedDate?: string;
  description?: string;
  relationship: LegendTeamRelationship;
  athleteRefs: LegendAthleteRef[];
}

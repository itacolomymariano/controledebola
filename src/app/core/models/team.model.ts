import { Address } from './address.model';

export interface AmateurTeam {
  objectId: string;
  name: string;
  presidentId: string;
  teamImageUrl: string | null;
  presidentImageUrl: string | null;
  shieldImageUrl?: string | null;
  headquartersImageUrl?: string | null;
  uniformId: string;
  uniformColors: [string, string, string];
  foundedAt?: Date | null;
  homeVenue?: string;
  homeVenueAddress?: Address | null;
  description?: string;
  averageAge?: number | null;
}

export interface CreateTeamPayload {
  name: string;
  teamImage: File;
  presidentImage: File;
  uniformId: string;
  foundedAt?: Date | null;
  homeVenue?: string;
  homeVenueAddress?: Address | null;
  description?: string;
  shieldImage?: File | null;
  headquartersImage?: File | null;
}

export interface UpdateTeamPayload {
  name?: string;
  uniformId?: string;
  foundedAt?: Date | null;
  homeVenue?: string;
  homeVenueAddress?: Address | null;
  description?: string;
  teamImage?: File | null;
  presidentImage?: File | null;
  shieldImage?: File | null;
  headquartersImage?: File | null;
}

export interface AmateurTeamMember {
  objectId: string;
  teamId: string;
  userId?: string;
  legendAthleteId?: string;
  source: 'athlete' | 'legend';
  apelido: string;
  avatarUrl?: string;
  position?: string;
  age?: number | null;
  birthDate?: string | null;
}

export interface TeamPickerRow {
  id: string;
  name: string;
  imageUrl?: string;
  averageAge?: number | null;
}

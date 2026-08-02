import { Address, normalizeBrazilUf } from './address.model';

export type PeladaSport = 'campo' | 'futsal' | 'society' | 'beach';

export type PeladaStatsConflictSource = 'referee' | 'scout';

export const PELADA_STATS_CONFLICT_SOURCE_LABELS: Record<PeladaStatsConflictSource, string> = {
  referee: 'Juiz / Arbitro',
  scout: 'Scout',
};

export const PELADA_SPORT_LABELS: Record<PeladaSport, string> = {
  campo: 'Campo',
  futsal: 'Futsal',
  society: 'Society',
  beach: 'Beach',
};

export interface Pelada {
  objectId: string;
  name: string;
  sport: PeladaSport;
  adminId: string;
  adminName: string;
  adminApelido?: string;
  adminAvatarUrl?: string;
  adminPhotoUrl?: string;
  address: Address;
  locationPhotoUrl?: string;
  memberCount: number;
  foundedAt?: Date;
  monthlyFee: number;
  socioGoodStandingPaymentExempt?: boolean;
  expulsionBanEventCount?: number;
  caixaMembersOnly?: boolean;
  maxSocios?: number;
  maxAthletesPerEvent?: number;
  statsConflictSource?: PeladaStatsConflictSource;
  requireProfilePresentationOnFirstEvent?: boolean;
  allowTeamSplitAfterEventEnd?: boolean;
}

export interface PeladaListItem extends Pelada {
  nearby?: boolean;
  /** Quantidade de eventos ja realizados (com separacao de times salva). */
  heldEventCount?: number;
  eventCount?: number;
  isCurrentUserAdmin?: boolean;
}

export interface CreatePeladaPayload {
  name: string;
  sport: PeladaSport;
  address: Address;
  memberCount?: number;
  foundedAt?: Date;
  monthlyFee?: number;
  adminPhotoFile?: File;
  locationPhotoFile?: File;
}

export interface UpdatePeladaPayload {
  name?: string;
  sport?: PeladaSport;
  address?: Address;
  memberCount?: number;
  foundedAt?: Date;
  monthlyFee?: number;
  adminPhotoFile?: File;
  locationPhotoFile?: File;
}

export interface UpdatePeladaSettingsPayload {
  socioGoodStandingPaymentExempt?: boolean;
  expulsionBanEventCount?: number;
  caixaMembersOnly?: boolean;
  maxSocios?: number;
  maxAthletesPerEvent?: number;
  statsConflictSource?: PeladaStatsConflictSource;
  requireProfilePresentationOnFirstEvent?: boolean;
  allowTeamSplitAfterEventEnd?: boolean;
}

export function formatPeladaLocation(pelada: Pelada): string {
  const { city, neighborhood } = pelada.address;
  const state = normalizeBrazilUf(pelada.address.state);
  return [state, city, neighborhood].filter(Boolean).join(' · ');
}

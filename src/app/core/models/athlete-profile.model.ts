export type AthleteMaritalStatus = 'casado' | 'solteiro';

export type AthleteFootPreference = import('./athlete-performance.model').AthleteFootPreference;
export type AthletePersonalStatsConflictSource =
  import('./athlete-performance.model').AthletePersonalStatsConflictSource;

export {
  ATHLETE_FOOT_OPTIONS,
  ATHLETE_FOOT_LABELS,
  ATHLETE_PERSONAL_STATS_CONFLICT_OPTIONS,
  formatFootPreference,
} from './athlete-performance.model';

export const ATHLETE_MARITAL_STATUS_OPTIONS: Array<{ value: AthleteMaritalStatus; label: string }> = [
  { value: 'casado', label: 'Casado' },
  { value: 'solteiro', label: 'Solteiro' },
];

export interface AthleteProfile {
  objectId: string;
  primaryPosition: string;
  secondaryPosition?: string;
  thirdPosition?: string;
  shoeSize: number;
  height: number;
  weight: number;
  maritalStatus?: AthleteMaritalStatus;
  footPreference?: AthleteFootPreference;
  personalTrainerUserId?: string;
  personalScoutUserId?: string;
  personalStatsConflictSource?: AthletePersonalStatsConflictSource;
  peladaRate?: number;
  teamMatchRate?: number;
  attendanceScore: number;
}

export interface CreateAthleteProfilePayload {
  primaryPosition: string;
  secondaryPosition?: string;
  thirdPosition?: string;
  shoeSize: number;
  height: number;
  weight: number;
  maritalStatus?: AthleteMaritalStatus;
  footPreference?: AthleteFootPreference;
  personalTrainerUserId?: string;
  personalScoutUserId?: string;
  personalStatsConflictSource?: AthletePersonalStatsConflictSource;
  peladaRate?: number;
  teamMatchRate?: number;
}

export const FOOTBALL_POSITIONS = [
  'Goleiro',
  'Lateral direito',
  'Lateral esquerdo',
  'Zagueiro',
  'Volante',
  'Meia',
  'Atacante',
];

export const SHOE_SIZES = Array.from({ length: 15 }, (_, index) => 34 + index);

export const WEIGHTS_KG = Array.from({ length: 86 }, (_, index) => 45 + index);

export const HEIGHT_METERS = [1, 2];

export const HEIGHT_CENTIMETERS = Array.from({ length: 100 }, (_, index) => index);

export function partsToHeightCm(meter: number, centimeters: number): number {
  return meter * 100 + centimeters;
}

export function heightCmToParts(totalCm: number): { meter: number; centimeters: number } {
  const meter = Math.floor(totalCm / 100);
  const centimeters = totalCm % 100;
  return { meter, centimeters };
}

export function formatHeightLabel(meter: number, centimeters: number): string {
  return `${meter},${centimeters.toString().padStart(2, '0')} m`;
}

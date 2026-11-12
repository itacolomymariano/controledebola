import { Address, normalizeBrazilUf } from '../models/address.model';

export interface MuralAthleteLocationFields {
  locationState?: string;
  locationCity?: string;
  locationNeighborhood?: string;
}

function trimLocationPart(value: unknown): string {
  return String(value ?? '').trim();
}

export function muralAthleteLocationFieldsFromAddress(
  address?: Address | Record<string, unknown> | null
): MuralAthleteLocationFields {
  if (!address || typeof address !== 'object') return {};
  const state = normalizeBrazilUf(trimLocationPart(address['state']));
  const city = trimLocationPart(address['city']);
  const neighborhood = trimLocationPart(address['neighborhood']);
  return {
    locationState: state || undefined,
    locationCity: city || undefined,
    locationNeighborhood: neighborhood || undefined,
  };
}

export function muralAthleteLocationLine(fields: MuralAthleteLocationFields): string {
  const parts = [
    fields.locationState,
    fields.locationCity,
    fields.locationNeighborhood,
  ].filter((part) => !!part?.trim());
  return parts.join(' · ');
}

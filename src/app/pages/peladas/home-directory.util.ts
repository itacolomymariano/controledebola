import Parse from 'parse';
import { Address, normalizeBrazilUf } from '../../core/models/address.model';
import { locationProximityScore } from '../../core/utils/location-proximity.util';
import { normalizeSearchText } from '../../core/utils/search-text.util';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function loggedUserAddress(): Address | undefined {
  const raw = Parse.User.current()?.get('address') as Address | undefined;
  if (!raw) return undefined;
  return { ...raw, state: normalizeBrazilUf(raw.state) };
}

export function addressFromParts(parts: {
  state?: string;
  city?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
}): Address {
  return {
    street: '',
    neighborhood: parts.neighborhood?.trim() || '',
    city: parts.city?.trim() || '',
    state: normalizeBrazilUf(parts.state),
    zipCode: '',
    latitude: typeof parts.latitude === 'number' ? parts.latitude : undefined,
    longitude: typeof parts.longitude === 'number' ? parts.longitude : undefined,
  };
}

export function formatPlaceLine(state?: string, city?: string, neighborhood?: string): string {
  return [normalizeBrazilUf(state), city?.trim(), neighborhood?.trim()].filter(Boolean).join(' · ');
}

export function formatPlaceLineWithExtra(address: Address | undefined, extra?: string): string {
  const line = formatPlaceLine(address?.state, address?.city, address?.neighborhood);
  const more = extra?.trim();
  return [line, more].filter(Boolean).join(' · ');
}

/** Mesmo bairro (com a mesma cidade), mesma cidade, mesmo estado; depois o restante. */
export function compareDirectoryProximity(
  userAddress: Address | undefined,
  aAddress: Address | undefined,
  bAddress: Address | undefined,
  aName: string,
  bName: string
): number {
  const tierDiff = proximityTier(userAddress, bAddress) - proximityTier(userAddress, aAddress);
  if (tierDiff !== 0) return tierDiff;
  const scoreDiff =
    locationProximityScore(userAddress, bAddress) - locationProximityScore(userAddress, aAddress);
  if (scoreDiff !== 0) return scoreDiff;
  return aName.localeCompare(bName, 'pt-BR');
}

export function directoryTextMatches(
  query: string,
  parts: Array<string | undefined | null>
): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  const haystack = normalizeSearchText(parts.filter((part) => !!part?.trim()).join(' '));
  return haystack.includes(needle);
}

/** dd/mm, dd/mm/aaaa e nome do mes, para busca em texto. */
export function dateSearchTokens(date: Date | undefined): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const day = date.getDate();
  const month = date.getMonth();
  const dd = String(day).padStart(2, '0');
  const mm = String(month + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return [
    `${dd}/${mm}`,
    `${dd}/${mm}/${yyyy}`,
    `${day}/${month + 1}`,
    MONTHS[month],
    MONTHS_SHORT[month],
  ].join(' ');
}

function proximityTier(userAddress: Address | undefined, place: Address | undefined): number {
  if (!userAddress || !place) return 0;
  const neighborhood = sameText(userAddress.neighborhood, place.neighborhood);
  const city = sameText(userAddress.city, place.city);
  const state = sameText(normalizeBrazilUf(userAddress.state), normalizeBrazilUf(place.state));
  if (neighborhood && city) return 3;
  if (city) return 2;
  if (state) return 1;
  return 0;
}

function sameText(left?: string, right?: string): boolean {
  const a = normalizeSearchText(left || '');
  const b = normalizeSearchText(right || '');
  return !!a && a === b;
}

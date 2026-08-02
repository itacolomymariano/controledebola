export interface ParsedCityLabel {
  city: string;
  state: string;
}

export interface ParsedNeighborhoodLabel {
  neighborhood: string;
  city: string;
  state: string;
}

export function parseCityLabel(label: string): ParsedCityLabel | null {
  const match = String(label || '').match(/^(.+)\s-\s([A-Za-z]{2})$/);
  if (!match) return null;
  return { city: match[1].trim(), state: match[2].trim().toUpperCase() };
}

export function parseNeighborhoodLabel(label: string): ParsedNeighborhoodLabel | null {
  const parts = String(label || '')
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      neighborhood: parts[0],
      city: parts[1],
      state: parts[2].toUpperCase(),
    };
  }
  if (parts.length === 2) {
    return { neighborhood: parts[0], city: parts[1], state: '' };
  }
  return null;
}

export function cityBelongsToState(cityLabel: string, state: string): boolean {
  const parsed = parseCityLabel(cityLabel);
  return parsed?.state === state.trim().toUpperCase();
}

export function neighborhoodBelongsToCity(neighborhoodLabel: string, city: string, state?: string): boolean {
  const parsed = parseNeighborhoodLabel(neighborhoodLabel);
  if (!parsed) return false;
  if (parsed.city.localeCompare(city, 'pt-BR', { sensitivity: 'base' }) !== 0) return false;
  if (state?.trim()) {
    return parsed.state === state.trim().toUpperCase();
  }
  return true;
}

export function displayCityName(cityLabel: string): string {
  return parseCityLabel(cityLabel)?.city ?? cityLabel;
}

export function displayNeighborhoodName(neighborhoodLabel: string): string {
  return parseNeighborhoodLabel(neighborhoodLabel)?.neighborhood ?? neighborhoodLabel;
}

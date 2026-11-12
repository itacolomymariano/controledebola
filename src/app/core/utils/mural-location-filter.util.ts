import { MuralLocationFilter } from '../models/mural.model';

export function muralLocationFilterFromParts(
  state?: string,
  city?: string,
  neighborhood?: string
): MuralLocationFilter {
  return {
    ...(state ? { state } : {}),
    ...(city ? { city } : {}),
    ...(neighborhood ? { neighborhood } : {}),
  };
}

/** Evita reload em loop quando o pai passa novo objeto com os mesmos valores. */
export function muralLocationFiltersEqual(
  a?: MuralLocationFilter,
  b?: MuralLocationFilter
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return (
    (a.state ?? '') === (b.state ?? '') &&
    (a.city ?? '') === (b.city ?? '') &&
    (a.neighborhood ?? '') === (b.neighborhood ?? '')
  );
}

import { ActivatedRoute } from '@angular/router';

/** Percorre pathFromRoot — necessario em rotas aninhadas (ex.: event/:id/mural/media/journal). */
export function resolveRouteParam(route: ActivatedRoute, key: string): string {
  for (const entry of route.pathFromRoot) {
    const value = entry.snapshot.paramMap.get(key);
    if (value) {
      return value;
    }
  }

  // Fallback Ionic/URL: em algumas pilhas de navegacao o param nao sobe no ActivatedRoute.
  if (key === 'id' && typeof window !== 'undefined') {
    const path = window.location?.pathname || '';
    const eventMatch = path.match(/\/event\/([^/]+)/);
    if (eventMatch?.[1]) {
      return decodeURIComponent(eventMatch[1]);
    }
    const peladaMatch = path.match(/\/pelada\/([^/]+)/);
    if (peladaMatch?.[1]) {
      return decodeURIComponent(peladaMatch[1]);
    }
  }

  return '';
}

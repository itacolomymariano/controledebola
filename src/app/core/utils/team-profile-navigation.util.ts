import { Router } from '@angular/router';
import { AthletePlayedTeamLink } from '../models/athlete-played-team.model';
import { LegendSuggestion } from '../models/amateur-legend.model';

export interface TeamProfileReturnState {
  returnUrl: string;
  returnLabel?: string;
}

const TEAM_RETURN_STORAGE_KEY = 'teamProfileReturnNavigation';

export function persistTeamProfileReturnState(state: TeamProfileReturnState): void {
  try {
    sessionStorage.setItem(TEAM_RETURN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function consumeTeamProfileReturnState(): TeamProfileReturnState | null {
  try {
    const raw = sessionStorage.getItem(TEAM_RETURN_STORAGE_KEY);
    sessionStorage.removeItem(TEAM_RETURN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TeamProfileReturnState;
  } catch {
    return null;
  }
}

export function teamProfileRoute(link: Pick<AthletePlayedTeamLink, 'kind' | 'teamId'>): string | null {
  const id = link.teamId?.trim();
  if (!id) return null;
  return link.kind === 'active' ? `/team/${id}` : `/legends/team/${id}`;
}

export function navigateToTeamProfile(
  router: Router,
  link: Pick<AthletePlayedTeamLink, 'kind' | 'teamId'>,
  returnState?: TeamProfileReturnState
): void {
  const route = teamProfileRoute(link);
  if (!route) return;
  if (returnState?.returnUrl) {
    persistTeamProfileReturnState(returnState);
  }
  void router.navigateByUrl(route);
}

export function legendSuggestionProfileRoute(item: LegendSuggestion): string | null {
  const id = item.id?.trim();
  if (!id) return null;
  switch (item.source) {
    case 'legend_team':
      return `/legends/team/${id}`;
    case 'app_team':
      return `/team/${id}`;
    case 'legend_athlete':
    case 'legend_pro_athlete':
      return `/legends/athlete/${id}`;
    case 'app_athlete':
      return `/tabs/home/directory/usuario/${id}`;
    default:
      return null;
  }
}

export function navigateToLegendSuggestionProfile(
  router: Router,
  item: LegendSuggestion,
  returnState?: TeamProfileReturnState
): void {
  const route = legendSuggestionProfileRoute(item);
  if (!route) return;
  if (returnState?.returnUrl) {
    persistTeamProfileReturnState(returnState);
  }
  void router.navigateByUrl(route);
}

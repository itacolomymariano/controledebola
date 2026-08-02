import { ActivatedRoute, Router } from '@angular/router';

export type LegendFormReturnField =
  | 'proFootballIdol'
  | 'amateurFootballIdol'
  | 'favoriteAmateurTeam'
  | 'legendAthleteAmateurTeam';

export interface LegendFormReturnState {
  returnUrl: string;
  returnField?: LegendFormReturnField;
  selectedValue?: string;
}

const LEGEND_FORM_RETURN_STORAGE_KEY = 'legendFormReturnNavigation';

export function persistLegendFormReturnState(state: LegendFormReturnState): void {
  try {
    sessionStorage.setItem(LEGEND_FORM_RETURN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy mode
  }
}

export function peekLegendFormReturnState(
  expectedReturnUrl?: string
): LegendFormReturnState | null {
  try {
    const raw = sessionStorage.getItem(LEGEND_FORM_RETURN_STORAGE_KEY);
    if (!raw) return null;

    const state = JSON.parse(raw) as LegendFormReturnState;
    if (expectedReturnUrl && state.returnUrl !== expectedReturnUrl) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function consumeLegendFormReturnState(
  expectedReturnUrl?: string
): LegendFormReturnState | null {
  const state = peekLegendFormReturnState(expectedReturnUrl);
  if (!state) return null;

  try {
    sessionStorage.removeItem(LEGEND_FORM_RETURN_STORAGE_KEY);
  } catch {
    // ignore
  }
  return state;
}

export function readLegendFormReturnContext(
  route: ActivatedRoute
): Pick<LegendFormReturnState, 'returnUrl' | 'returnField'> | null {
  const returnUrl = String(route.snapshot.queryParamMap.get('returnUrl') || '').trim();
  const returnField = route.snapshot.queryParamMap.get('returnField') as
    | LegendFormReturnField
    | null;

  if (returnUrl) {
    return {
      returnUrl,
      returnField: returnField || undefined,
    };
  }

  const stored = peekLegendFormReturnState();
  if (!stored?.returnUrl) return null;

  return {
    returnUrl: stored.returnUrl,
    returnField: stored.returnField,
  };
}

export function finishLegendFormNavigation(
  router: Router,
  route: ActivatedRoute,
  createdLabel: string
): void {
  const context = readLegendFormReturnContext(route);
  if (context?.returnUrl) {
    persistLegendFormReturnState({
      returnUrl: context.returnUrl,
      returnField: context.returnField,
      selectedValue: createdLabel.trim(),
    });
    void router.navigateByUrl(context.returnUrl);
    return;
  }

  void router.navigateByUrl('/legends');
}

export function cancelLegendFormNavigation(router: Router, route: ActivatedRoute): void {
  const context = readLegendFormReturnContext(route);
  if (context?.returnUrl) {
    void router.navigateByUrl(context.returnUrl);
    return;
  }

  void router.navigateByUrl('/legends');
}

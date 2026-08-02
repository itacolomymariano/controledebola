import { HireableRole } from '../models/event-hiring.model';

export interface ProfileReturnNavigationState {
  returnUrl: string;
  hiringRole?: HireableRole;
  hiringSearch?: string;
}

const PROFILE_RETURN_STORAGE_KEY = 'profileReturnNavigation';

export function createEventHiringProfileReturnState(
  eventId: string,
  role: HireableRole,
  search: string
): ProfileReturnNavigationState {
  return {
    returnUrl: `/event/${eventId}`,
    hiringRole: role,
    hiringSearch: search,
  };
}

export function persistProfileReturnNavigationState(state: ProfileReturnNavigationState): void {
  sessionStorage.setItem(PROFILE_RETURN_STORAGE_KEY, JSON.stringify(state));
}

export function peekProfileReturnNavigationState(
  expectedReturnUrl?: string
): ProfileReturnNavigationState | null {
  const raw = sessionStorage.getItem(PROFILE_RETURN_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const state = JSON.parse(raw) as ProfileReturnNavigationState;
    if (expectedReturnUrl && state.returnUrl !== expectedReturnUrl) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function consumeProfileReturnNavigationState(
  expectedReturnUrl?: string
): ProfileReturnNavigationState | null {
  const raw = sessionStorage.getItem(PROFILE_RETURN_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const state = JSON.parse(raw) as ProfileReturnNavigationState;
    if (expectedReturnUrl && state.returnUrl !== expectedReturnUrl) {
      return null;
    }
    sessionStorage.removeItem(PROFILE_RETURN_STORAGE_KEY);
    return state;
  } catch {
    sessionStorage.removeItem(PROFILE_RETURN_STORAGE_KEY);
    return null;
  }
}

export function readProfileReturnNavigationState(): ProfileReturnNavigationState | null {
  const state = history.state as Partial<ProfileReturnNavigationState> | undefined;
  if (!state?.returnUrl || typeof state.returnUrl !== 'string') {
    return null;
  }
  return {
    returnUrl: state.returnUrl,
    hiringRole: state.hiringRole,
    hiringSearch: state.hiringSearch,
  };
}

export function buildProfileReturnUrl(state: ProfileReturnNavigationState): string {
  const eventId = state.returnUrl.replace(/^\/event\//, '');
  if (!state.hiringRole || !eventId) {
    return state.returnUrl;
  }
  const params = new URLSearchParams({
    panel: 'hiring',
    role: state.hiringRole,
  });
  const search = state.hiringSearch?.trim();
  if (search) {
    params.set('search', search);
  }
  return `/event/${eventId}?${params.toString()}`;
}

export function navigateToProfileReturn(
  router: { navigateByUrl: (url: string) => Promise<boolean> },
  state: ProfileReturnNavigationState
): void {
  void router.navigateByUrl(buildProfileReturnUrl(state));
}

export function clearProfileReturnNavigationState(): void {
  sessionStorage.removeItem(PROFILE_RETURN_STORAGE_KEY);
}

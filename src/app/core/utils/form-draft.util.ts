/** Rascunhos locais (sessionStorage) para wizards de formulário. */

export function readFormDraft<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeFormDraft<T>(key: string, value: T): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota ou modo privado
  }
}

export function clearFormDraft(key: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const PELADA_FORM_DRAFT_KEY = 'pelada-form-draft';
export const DESAFIO_FORM_DRAFT_KEY = 'desafio-form-draft';
export const ROLE_PROFILE_FORM_DRAFT_KEY = 'role-profile-form-draft';
export const TEAM_FORM_DRAFT_KEY = 'team-form-draft';
export const EVENT_CREATE_FORM_DRAFT_KEY = 'event-create-form-draft';
export const CONFRONTO_FORM_DRAFT_KEY = 'confronto-create-form-draft';
export const FAN_PROFILE_FORM_DRAFT_KEY = 'fan-profile-form-draft';
export const ATHLETE_PROFILE_FORM_DRAFT_KEY = 'athlete-profile-form-draft';

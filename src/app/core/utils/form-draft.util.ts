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

export function formatTeamMatchDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

/** Codigo de resultado do Cloud (W/D/L) -> letra pt-BR (V/E/D). */
export type TeamMatchResultCode = 'W' | 'D' | 'L';

export function teamMatchResultI18nKey(code: string | null | undefined): string {
  switch (code) {
    case 'W':
      return 'teamMatch.result.win';
    case 'L':
      return 'teamMatch.result.loss';
    case 'D':
      return 'teamMatch.result.draw';
    default:
      return '';
  }
}

export function teamMatchResultLetter(code: string | null | undefined): string {
  switch (code) {
    case 'W':
      return 'V';
    case 'L':
      return 'D';
    case 'D':
      return 'E';
    default:
      return '—';
  }
}

export function teamMatchResultColor(code: string | null | undefined): string {
  switch (code) {
    case 'W':
      return 'success';
    case 'L':
      return 'danger';
    case 'D':
      return 'medium';
    default:
      return 'light';
  }
}

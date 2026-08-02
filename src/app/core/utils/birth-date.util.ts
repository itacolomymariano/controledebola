export const BIRTH_DATE_MIN_YEAR = 1900;

export const BIRTH_DATE_MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Marco' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export function buildBirthYearOptions(maxYear = new Date().getFullYear()): number[] {
  const years: number[] = [];
  for (let year = maxYear; year >= BIRTH_DATE_MIN_YEAR; year -= 1) {
    years.push(year);
  }
  return years;
}

export function daysInBirthMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

export function buildBirthDayOptions(month: number, year: number): number[] {
  const total = daysInBirthMonth(month, year);
  return Array.from({ length: total }, (_, index) => index + 1);
}

export function buildBirthDateFromParts(
  day: number | null | undefined,
  month: number | null | undefined,
  year: number | null | undefined
): Date | null {
  if (!day || !month || !year) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    year < BIRTH_DATE_MIN_YEAR ||
    date > new Date()
  ) {
    return null;
  }

  return date;
}

export function birthDateToIsoString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function splitBirthDateIso(value: string | null | undefined): {
  day: number | null;
  month: number | null;
  year: number | null;
} {
  const parsed = parseBirthDateIso(value);
  if (!parsed) {
    return { day: null, month: null, year: null };
  }
  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
  };
}

export function parseBirthDateIso(value: string | null | undefined): Date | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return buildBirthDateFromParts(day, month, year);
  }

  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    return buildBirthDateFromParts(Number(brMatch[1]), Number(brMatch[2]), Number(brMatch[3]));
  }

  return null;
}

export function formatBirthDateDisplay(value: string | null | undefined): string {
  const date = parseBirthDateIso(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

import { AppLocale } from '../models/app-locale.model';

const INTL_LOCALE: Record<AppLocale, string> = {
  'pt-BR': 'pt-BR',
  'en-GB': 'en-GB',
  'es-ES': 'es-ES',
};

export function intlLocaleForApp(locale: AppLocale): string {
  return INTL_LOCALE[locale] ?? 'pt-BR';
}

export function formatAppDateTime(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlLocaleForApp(locale), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatAppCurrency(amount: number, locale: AppLocale): string {
  return new Intl.NumberFormat(intlLocaleForApp(locale), {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}
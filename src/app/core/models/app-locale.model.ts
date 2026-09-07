export const APP_LOCALES = ['pt-BR', 'es-ES', 'en-GB'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const APP_LOCALE_LABELS: Record<AppLocale, string> = {
  'pt-BR': 'Português (Brasil)',
  'es-ES': 'Español (España)',
  'en-GB': 'English (United Kingdom)',
};

export const DEFAULT_APP_LOCALE: AppLocale = 'pt-BR';

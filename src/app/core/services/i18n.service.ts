import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AppStorageService } from './app-storage.service';
import { duplicateValueMessage } from '../utils/parse-error.util';
import {
  APP_LOCALES,
  APP_LOCALE_LABELS,
  AppLocale,
  DEFAULT_APP_LOCALE,
} from '../models/app-locale.model';

type Dict = Record<string, string>;

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale$ = new BehaviorSubject<AppLocale>(DEFAULT_APP_LOCALE);
  readonly locales = APP_LOCALES;
  readonly localeLabels = APP_LOCALE_LABELS;

  private dict: Dict = {};
  private fallback: Dict = {};
  private tick = 0;

  constructor(
    private readonly http: HttpClient,
    private readonly storage: AppStorageService
  ) {}

  get locale(): AppLocale {
    return this.locale$.value;
  }

  /** Incremented on language change so impure pipes refresh. */
  get revision(): number {
    return this.tick;
  }

  async init(): Promise<void> {
    this.fallback = await this.loadFile(DEFAULT_APP_LOCALE);
    const saved = await this.storage.getLocale();
    await this.setLocale(saved ?? DEFAULT_APP_LOCALE, false);
  }

  async setLocale(locale: AppLocale, persist = true): Promise<void> {
    const next = APP_LOCALES.includes(locale) ? locale : DEFAULT_APP_LOCALE;
    this.dict = next === DEFAULT_APP_LOCALE ? this.fallback : await this.loadFile(next);
    this.locale$.next(next);
    this.tick += 1;
    if (persist) {
      await this.storage.setLocale(next);
    }
  }

  t(key: string, params?: Record<string, string | number>): string {
    const raw = this.dict[key] ?? this.fallback[key] ?? key;
    if (!params) return raw;
    return Object.entries(params).reduce((acc, [name, value]) => {
      const text = String(value);
      return acc.split(`{{${name}}}`).join(text).split(`{${name}}`).join(text);
    }, raw);
  }

  /** Rótulo de progresso de wizard (Passo N de M). */
  wizardProgress(key: string, current: number, total: number): string {
    return this.t(key, { current, total });
  }

  translateError(error: unknown): string {
    const code = error && typeof error === 'object' ? (error as { code?: number }).code : undefined;
    if (code === 101) return this.t('error.invalidCredentials');
    if (code === 202) return this.t('error.usernameTaken');
    if (code === 203) return this.t('error.emailTaken');
    if (code === 205) return this.t('error.emailNotFound');
    if (code === 125) return this.t('error.invalidEmail');
    if (code === 209) return this.t('error.sessionExpired');
    const message =
      error && typeof error === 'object' ? String((error as { message?: string }).message ?? '') : '';
    if (code === 137) {
      if (/\bcpf\b/i.test(message)) return duplicateValueMessage(message);
      if (!message || /apelido|nickname|duplicate value for a field/i.test(message)) {
        return this.t('error.nicknameTaken');
      }
      return message;
    }
    const key = this.errorMessageToKey(message);
    if (key) return this.t(key);
    if (error instanceof Error && message) return message;
    return message || this.t('error.generic');
  }

  /** Mensagens cruas do Parse/HTTP em ingles → chave i18n. */
  private errorMessageToKey(message: string): string | null {
    const trimmed = message.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === 'unauthorized' || lower.includes('not authorized') || lower.includes('needs to be authenticated')) {
      return 'error.unauthorized';
    }
    if (/invalid\s+username|username\/password/i.test(trimmed)) {
      return 'error.invalidCredentials';
    }
    if (/invalid session token/i.test(trimmed)) {
      return 'error.sessionExpired';
    }
    return null;
  }

  private async loadFile(locale: AppLocale): Promise<Dict> {
    try {
      return await firstValueFrom(this.http.get<Dict>(`assets/i18n/${locale}.json`));
    } catch {
      return {};
    }
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AppStorageService } from './app-storage.service';
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
    return Object.entries(params).reduce(
      (acc, [name, value]) => acc.split(`{{${name}}}`).join(String(value)),
      raw
    );
  }

  translateError(error: unknown): string {
    const code = error && typeof error === 'object' ? (error as { code?: number }).code : undefined;
    if (code === 101) return this.t('error.invalidCredentials');
    if (code === 202) return this.t('error.usernameTaken');
    if (code === 203) return this.t('error.emailTaken');
    if (code === 205) return this.t('error.emailNotFound');
    if (code === 125) return this.t('error.invalidEmail');
    if (code === 209) return this.t('error.sessionExpired');
    if (code === 137) return this.t('error.nicknameTaken');
    const message = error instanceof Error ? error.message : '';
    return message || this.t('error.generic');
  }

  private async loadFile(locale: AppLocale): Promise<Dict> {
    try {
      return await firstValueFrom(this.http.get<Dict>(`assets/i18n/${locale}.json`));
    } catch {
      return {};
    }
  }
}

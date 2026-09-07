import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

import { AppLocale, DEFAULT_APP_LOCALE } from '../models/app-locale.model';
import { DEFAULT_THEME_PALETTE, ThemePaletteId, THEME_PALETTE_IDS } from '../models/theme-palette.model';
import { WizardPath } from '../models/wizard.model';

const ONBOARDING_KEY = 'onboarding_complete';
const BIOMETRIC_KEY = 'biometric_enabled';
const WIZARD_PATH_KEY = 'wizard_path';
const PROFILE_WIZARD_COMPLETE_KEY = 'profile_wizard_complete';
const LOCALE_KEY = 'app_locale';
const PALETTE_KEY = 'app_palette';
const COACH_HINT_PREFIX = 'coach_hint_dismissed_';

@Injectable({ providedIn: 'root' })
export class AppStorageService {
  private ready = false;
  constructor(private readonly storage: Storage) {}

  async init(): Promise<void> {
    if (!this.ready) {
      await this.storage.create();
      this.ready = true;
    }
  }

  async isOnboardingComplete(): Promise<boolean> {
    await this.init();
    return (await this.storage.get(ONBOARDING_KEY)) === true;
  }

  async setOnboardingComplete(): Promise<void> {
    await this.init();
    await this.storage.set(ONBOARDING_KEY, true);
  }

  async isBiometricEnabled(): Promise<boolean> {
    await this.init();
    return (await this.storage.get(BIOMETRIC_KEY)) === true;
  }

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await this.init();
    await this.storage.set(BIOMETRIC_KEY, enabled);
  }

  async getWizardPath(): Promise<WizardPath | null> {
    await this.init();
    const value = await this.storage.get(WIZARD_PATH_KEY);
    return value === 'athlete' || value === 'other' ? value : null;
  }

  async setWizardPath(path: WizardPath): Promise<void> {
    await this.init();
    await this.storage.set(WIZARD_PATH_KEY, path);
  }

  async clearWizardPath(): Promise<void> {
    await this.init();
    await this.storage.remove(WIZARD_PATH_KEY);
  }

  async isProfileWizardComplete(): Promise<boolean> {
    await this.init();
    return (await this.storage.get(PROFILE_WIZARD_COMPLETE_KEY)) === true;
  }

  async setProfileWizardComplete(): Promise<void> {
    await this.init();
    await this.storage.set(PROFILE_WIZARD_COMPLETE_KEY, true);
  }

  async needsProfileSetup(): Promise<boolean> {
    if (await this.isProfileWizardComplete()) return false;
    return (await this.getWizardPath()) !== null;
  }

  async getLocale(): Promise<AppLocale | null> {
    await this.init();
    const value = await this.storage.get(LOCALE_KEY);
    return value === 'pt-BR' || value === 'es-ES' || value === 'en-GB' ? value : null;
  }

  async setLocale(locale: AppLocale): Promise<void> {
    await this.init();
    await this.storage.set(LOCALE_KEY, locale ?? DEFAULT_APP_LOCALE);
  }

  async getPalette(): Promise<ThemePaletteId> {
    await this.init();
    const value = await this.storage.get(PALETTE_KEY);
    return typeof value === 'string' && (THEME_PALETTE_IDS as readonly string[]).includes(value)
      ? (value as ThemePaletteId)
      : DEFAULT_THEME_PALETTE;
  }

  async setPalette(palette: ThemePaletteId): Promise<void> {
    await this.init();
    await this.storage.set(PALETTE_KEY, palette);
  }

  async isCoachHintDismissed(tipId: string): Promise<boolean> {
    await this.init();
    return (await this.storage.get(COACH_HINT_PREFIX + tipId)) === true;
  }

  async dismissCoachHint(tipId: string): Promise<void> {
    await this.init();
    await this.storage.set(COACH_HINT_PREFIX + tipId, true);
  }
}

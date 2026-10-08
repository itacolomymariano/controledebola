import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

import { AppLocale, DEFAULT_APP_LOCALE } from '../models/app-locale.model';
import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SURFACE,
  THEME_PALETTE_IDS,
  THEME_SURFACE_IDS,
  ThemePaletteId,
  ThemeSurfaceId,
} from '../models/theme-palette.model';
import { ParticipationChoice, WizardPath } from '../models/wizard.model';

export interface BiometricCredentials {
  identifier: string;
  password: string;
}

const ONBOARDING_KEY = 'onboarding_complete';
const BIOMETRIC_KEY = 'biometric_enabled';
const BIOMETRIC_CREDS_KEY = 'biometric_creds';
const WIZARD_PATH_KEY = 'wizard_path';
const PARTICIPATION_CHOICE_KEY = 'participation_choice';
const PROFILE_WIZARD_COMPLETE_KEY = 'profile_wizard_complete';
const LOCALE_KEY = 'app_locale';
const PALETTE_KEY = 'app_palette';
const SURFACE_KEY = 'app_surface';
const COACH_HINT_PREFIX = 'coach_hint_dismissed_';
const WIZARD_TOUR_OFFERED_KEY = 'wizard_tour_offered';
const WIZARD_TOUR_DISMISSED_KEY = 'wizard_tour_dismissed';
const CONTRACT_INBOX_SEEN_PREFIX = 'contract_inbox_seen:';

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
    if (!enabled) {
      await this.storage.remove(BIOMETRIC_CREDS_KEY);
    }
  }

  async saveBiometricCredentials(identifier: string, password: string): Promise<void> {
    const trimmedId = identifier.trim();
    if (!trimmedId || !password) return;
    await this.init();
    const payload: BiometricCredentials = { identifier: trimmedId, password };
    await this.storage.set(BIOMETRIC_CREDS_KEY, payload);
  }

  async getBiometricCredentials(): Promise<BiometricCredentials | null> {
    await this.init();
    const value = await this.storage.get(BIOMETRIC_CREDS_KEY);
    if (!value || typeof value !== 'object') return null;
    const identifier = String((value as BiometricCredentials).identifier || '').trim();
    const password = String((value as BiometricCredentials).password || '');
    if (!identifier || !password) return null;
    return { identifier, password };
  }

  async hasBiometricCredentials(): Promise<boolean> {
    return (await this.getBiometricCredentials()) !== null;
  }

  async updateBiometricPasswordIfMatch(identifier: string, password: string): Promise<void> {
    if (!(await this.isBiometricEnabled()) || !password) return;
    const creds = await this.getBiometricCredentials();
    if (!creds) return;
    const stored = creds.identifier.trim().toLowerCase();
    const next = identifier.trim().toLowerCase();
    if (!next || (stored !== next && !stored.includes(next) && !next.includes(stored))) {
      return;
    }
    await this.saveBiometricCredentials(creds.identifier, password);
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

  async getParticipationChoice(): Promise<ParticipationChoice | null> {
    await this.init();
    const value = await this.storage.get(PARTICIPATION_CHOICE_KEY);
    return value === 'pelada' || value === 'amateur_team' || value === 'other' ? value : null;
  }

  async setParticipationChoice(choice: ParticipationChoice): Promise<void> {
    await this.init();
    await this.storage.set(PARTICIPATION_CHOICE_KEY, choice);
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

  async getSurface(): Promise<ThemeSurfaceId> {
    await this.init();
    const value = await this.storage.get(SURFACE_KEY);
    return typeof value === 'string' && (THEME_SURFACE_IDS as readonly string[]).includes(value)
      ? (value as ThemeSurfaceId)
      : DEFAULT_THEME_SURFACE;
  }

  async setSurface(surface: ThemeSurfaceId): Promise<void> {
    await this.init();
    await this.storage.set(SURFACE_KEY, surface);
  }

  async isCoachHintDismissed(tipId: string): Promise<boolean> {
    await this.init();
    return (await this.storage.get(COACH_HINT_PREFIX + tipId)) === true;
  }

  async dismissCoachHint(tipId: string): Promise<void> {
    await this.init();
    await this.storage.set(COACH_HINT_PREFIX + tipId, true);
  }

  async hasWizardTourBeenOffered(userId: string): Promise<boolean> {
    await this.init();
    return (await this.storage.get(this.wizardTourKey(WIZARD_TOUR_OFFERED_KEY, userId))) === true;
  }

  async setWizardTourOffered(userId: string): Promise<void> {
    await this.init();
    await this.storage.set(this.wizardTourKey(WIZARD_TOUR_OFFERED_KEY, userId), true);
  }

  async isWizardTourDismissed(userId: string): Promise<boolean> {
    await this.init();
    return (await this.storage.get(this.wizardTourKey(WIZARD_TOUR_DISMISSED_KEY, userId))) === true;
  }

  async setWizardTourDismissed(userId: string): Promise<void> {
    await this.init();
    await this.storage.set(this.wizardTourKey(WIZARD_TOUR_DISMISSED_KEY, userId), true);
  }

  private wizardTourKey(prefix: string, userId: string): string {
    return `${prefix}:${userId}`;
  }

  async isContractInboxSeen(userId: string, invitationId: string): Promise<boolean> {
    if (!userId || !invitationId) return false;
    await this.init();
    return (await this.storage.get(`${CONTRACT_INBOX_SEEN_PREFIX}${userId}:${invitationId}`)) === true;
  }

  async setContractInboxSeen(userId: string, invitationId: string): Promise<void> {
    if (!userId || !invitationId) return;
    await this.init();
    await this.storage.set(`${CONTRACT_INBOX_SEEN_PREFIX}${userId}:${invitationId}`, true);
  }
}

import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

import { WizardPath } from '../models/wizard.model';

const ONBOARDING_KEY = 'onboarding_complete';
const BIOMETRIC_KEY = 'biometric_enabled';
const WIZARD_PATH_KEY = 'wizard_path';
const PROFILE_WIZARD_COMPLETE_KEY = 'profile_wizard_complete';

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
}

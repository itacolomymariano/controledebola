import { Injectable } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { AppStorageService } from './app-storage.service';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';

export type BiometricUnlockResult = 'ok' | 'needs-enroll' | 'disabled';

@Injectable({ providedIn: 'root' })
export class BiometricUnlockService {
  constructor(
    private readonly storage: AppStorageService,
    private readonly auth: AuthService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly i18n: I18nService
  ) {}

  async isEnabled(): Promise<boolean> {
    return this.storage.isBiometricEnabled();
  }

  async isReady(): Promise<boolean> {
    if (!(await this.storage.isBiometricEnabled())) return false;
    return this.storage.hasBiometricCredentials();
  }

  async shouldShowUnlock(): Promise<boolean> {
    return (await this.storage.isBiometricEnabled()) || (await this.storage.hasBiometricCredentials());
  }

  async enable(identifier: string, password: string): Promise<void> {
    await this.storage.saveBiometricCredentials(identifier, password);
    await this.storage.setBiometricEnabled(true);
  }

  async disable(): Promise<void> {
    await this.storage.setBiometricEnabled(false);
  }

  currentIdentifier(): string {
    const user = this.auth.getCurrentUser();
    return ((user?.getEmail() as string) || user?.getUsername() || '').trim();
  }

  async tryUnlock(): Promise<BiometricUnlockResult> {
    if (this.auth.isLoggedIn()) {
      const valid = await this.auth.validateSession();
      if (valid) return 'ok';
    }

    const creds = await this.storage.getBiometricCredentials();
    if (creds) {
      await this.auth.login(creds.identifier, creds.password);
      return 'ok';
    }

    if (await this.storage.isBiometricEnabled()) {
      return 'needs-enroll';
    }
    return 'disabled';
  }

  async promptEnableWithPassword(): Promise<boolean> {
    const identifier = this.currentIdentifier();
    if (!this.auth.isLoggedIn() || !identifier) {
      return false;
    }

    const alert = await this.alertCtrl.create({
      header: this.i18n.t('menu.biometric'),
      message: this.i18n.t('menu.biometricRegisterHint'),
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: this.i18n.t('login.password'),
        },
      ],
      buttons: [
        { text: this.i18n.t('confirm.cancel'), role: 'cancel' },
        { text: this.i18n.t('menu.biometricConfirm'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: { password?: string } }>();
    if (role !== 'confirm') return false;

    const password = String(data?.values?.password || '').trim();
    if (!password) return false;
    return this.loginAndEnable(identifier, password);
  }

  async promptEnroll(prefillIdentifier = ''): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('menu.biometric'),
      message: this.i18n.t('menu.biometricEnrollHint'),
      inputs: [
        {
          name: 'identifier',
          type: 'text',
          value: prefillIdentifier,
          placeholder: this.i18n.t('login.identifier'),
        },
        {
          name: 'password',
          type: 'password',
          placeholder: this.i18n.t('login.password'),
        },
      ],
      buttons: [
        { text: this.i18n.t('confirm.cancel'), role: 'cancel' },
        { text: this.i18n.t('menu.biometricConfirm'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{
      values?: { identifier?: string; password?: string };
    }>();
    if (role !== 'confirm') return false;

    const identifier = String(data?.values?.identifier || prefillIdentifier || '').trim();
    const password = String(data?.values?.password || '').trim();
    if (!identifier || !password) return false;
    return this.loginAndEnable(identifier, password);
  }

  async promptFromMenu(): Promise<'enabled' | 'disabled' | 'cancelled'> {
    if (await this.isReady()) {
      const alert = await this.alertCtrl.create({
        header: this.i18n.t('menu.biometric'),
        message: this.i18n.t('menu.biometricAlready'),
        buttons: [
          { text: this.i18n.t('confirm.cancel'), role: 'cancel' },
          { text: this.i18n.t('menu.biometricDisable'), role: 'destructive' },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'destructive') return 'cancelled';
      await this.disable();
      return 'disabled';
    }

    const ok = await this.promptEnableWithPassword();
    return ok ? 'enabled' : 'cancelled';
  }

  private async loginAndEnable(identifier: string, password: string): Promise<boolean> {
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('login.entering') });
    await loading.present();
    try {
      await this.auth.login(identifier, password);
      await this.enable(identifier, password);
      return true;
    } catch {
      const error = await this.alertCtrl.create({
        header: this.i18n.t('login.failed'),
        message: this.i18n.t('menu.biometricWrong'),
        buttons: [this.i18n.t('ok')],
      });
      await error.present();
      return false;
    } finally {
      await loading.dismiss();
    }
  }
}

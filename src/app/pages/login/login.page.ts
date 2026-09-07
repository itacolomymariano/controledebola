import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { MIN_PASSWORD_LENGTH } from '../../core/constants/auth.constants';
import { AppStorageService } from '../../core/services/app-storage.service';
import { PostAuthNavigationService } from '../../core/services/post-auth-navigation.service';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  readonly passwordResetEnabled = environment.passwordResetEnabled;

  showPassword = false;
  forgotPasswordMode = false;
  biometricEnabled = false;
  canUseBiometric = false;

  form = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  resetForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly storage: AppStorageService,
    private readonly postAuthNav: PostAuthNavigationService,
    private readonly i18n: I18nService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.biometricEnabled = await this.storage.isBiometricEnabled();
    this.canUseBiometric = this.biometricEnabled && this.auth.isLoggedIn();

    if (!this.canUseBiometric) return;

    const loading = await this.loadingCtrl.create({ message: this.i18n.t('login.entering') });
    await loading.present();

    try {
      const valid = await this.auth.validateSession();
      if (valid) {
        await this.postAuthNav.navigateAfterAuth();
      }
    } finally {
      await loading.dismiss();
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  openForgotPassword(): void {
    this.forgotPasswordMode = true;
  }

  backToLogin(): void {
    this.forgotPasswordMode = false;
  }

  goRegister(): void {
    void this.router.navigateByUrl('/register');
  }

  async loginWithBiometric(): Promise<void> {
    if (!this.biometricEnabled) {
      await this.showError(this.i18n.t('login.biometricEnable'));
      return;
    }

    if (!this.auth.isLoggedIn()) {
      await this.showError(
        this.i18n.t('login.biometricOnce')
      );
      return;
    }

    const loading = await this.loadingCtrl.create({ message: this.i18n.t('login.entering') });
    await loading.present();

    try {
      const valid = await this.auth.validateSession();
      if (!valid) {
        await this.showError(this.i18n.t('login.sessionExpired'));
        return;
      }
      await this.postAuthNav.navigateAfterAuth();
    } finally {
      await loading.dismiss();
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.get('identifier')?.invalid) {
        await this.showError(this.i18n.t('login.identifierError'));
        return;
      }
      if (this.form.get('password')?.invalid) {
        await this.showError(this.i18n.t('login.passwordError'));
        return;
      }
      return;
    }

    const loading = await this.loadingCtrl.create({ message: this.i18n.t('login.entering') });
    await loading.present();

    try {
      const { identifier, password } = this.form.getRawValue();
      await this.auth.login(identifier!, password!);

      if (this.auth.needsPasswordUpgrade(password!)) {
        await loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Atualize sua senha',
          message: `Por seguranca, sua senha precisa ter no minimo ${MIN_PASSWORD_LENGTH} caracteres. Altere agora para continuar usando o app.`,
          buttons: ['OK'],
        });
        await alert.present();
        await alert.onDidDismiss();
        await this.router.navigate(['/account/edit'], { queryParams: { forcePassword: '1' } });
        return;
      }

      await this.postAuthNav.navigateAfterAuth();
      await this.offerBiometric();
    } catch (error: unknown) {
      await this.showError(this.i18n.translateError(error) || this.i18n.t('login.failed'));
    } finally {
      await loading.dismiss();
    }
  }

  async submitPasswordReset(): Promise<void> {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: this.i18n.t('login.sending') });
    await loading.present();

    try {
      const email = this.resetForm.getRawValue().email!;
      await this.auth.requestPasswordReset(email);
      this.forgotPasswordMode = false;
      this.resetForm.reset();
      await loading.dismiss();

      const alert = await this.alertCtrl.create({
        header: this.i18n.t('login.resetSentTitle'),
        message: this.i18n.t('login.resetSentBody'),
        buttons: [this.i18n.t('ok')],
      });
      await alert.present();
      return;
    } catch (error: unknown) {
      await this.showError(
        this.i18n.translateError(error) || this.i18n.t('login.resetFailed')
      );
    } finally {
      await loading.dismiss();
    }
  }

  private async offerBiometric(): Promise<void> {
    const already = await this.storage.isBiometricEnabled();
    if (already) return;

    const alert = await this.alertCtrl.create({
      header: 'Login rapido',
      message: 'Deseja ativar login por biometria neste dispositivo?',
      buttons: [
        { text: 'Agora nao', role: 'cancel' },
        {
          text: 'Ativar',
          handler: () => {
            void this.storage.setBiometricEnabled(true);
          },
        },
      ],
    });
    await alert.present();
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

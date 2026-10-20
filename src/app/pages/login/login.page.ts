import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { formatAppReleaseFullLabel } from '../../core/constants/app-release-display.util';
import { MIN_PASSWORD_LENGTH } from '../../core/constants/auth.constants';
import { AppStorageService } from '../../core/services/app-storage.service';
import { BiometricUnlockService } from '../../core/services/biometric-unlock.service';
import { PostAuthNavigationService } from '../../core/services/post-auth-navigation.service';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../core/services/i18n.service';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit, OnDestroy {
  readonly passwordResetEnabled = environment.passwordResetEnabled;
  readonly appVersion = formatAppReleaseFullLabel();

  showPassword = false;
  showNewPassword = false;
  forgotPasswordMode = false;
  resetStep: 'email' | 'code' = 'email';
  /** Exibido na tela de codigo apos envio bem-sucedido. */
  resetCodeSentNotice = false;
  biometricEnabled = false;
  showBiometricUnlock = false;

  form = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  resetForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  confirmResetForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
    confirmPassword: ['', Validators.required],
  });

  private navSub?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly storage: AppStorageService,
    private readonly biometric: BiometricUnlockService,
    private readonly postAuthNav: PostAuthNavigationService,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.navSub = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects.split('?')[0];
      if (url === '/login') void this.refreshBiometricAccess();
    });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.auth.isLoggedIn()) this.forgotPasswordMode = false;
    await this.refreshBiometricAccess();

    if (!this.auth.isLoggedIn()) return;

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
    this.resetStep = 'email';
    this.resetCodeSentNotice = false;
  }

  backToLogin(): void {
    this.forgotPasswordMode = false;
    this.resetStep = 'email';
    this.resetCodeSentNotice = false;
    this.confirmResetForm.reset();
  }

  get resetEmailMasked(): string {
    const email = String(this.resetForm.getRawValue().email || '').trim();
    if (!email.includes('@')) return email;
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.length <= 2 ? local[0] || '*' : `${local.slice(0, 2)}***`;
    return `${visible}@${domain}`;
  }

  backToResetEmail(): void {
    this.resetStep = 'email';
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  goRegister(): void {
    void this.router.navigateByUrl('/register');
  }

  async loginWithBiometric(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('login.entering') });
    await loading.present();

    let result: 'ok' | 'needs-enroll' | 'disabled' = 'disabled';
    try {
      result = await this.biometric.tryUnlock();
      if (result === 'ok') {
        await this.postAuthNav.navigateAfterAuth();
        return;
      }
    } catch {
      await this.showError(this.i18n.t('login.biometricFailed'));
      return;
    } finally {
      await loading.dismiss();
    }

    if (result === 'disabled') {
      await this.showError(this.i18n.t('login.biometricEnable'));
      return;
    }

    const identifier = this.form.getRawValue().identifier || '';
    const enrolled = await this.biometric.promptEnroll(identifier);
    if (enrolled) {
      this.showBiometricUnlock = true;
      await this.postAuthNav.navigateAfterAuth();
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
      this.resetStep = 'code';
      this.resetCodeSentNotice = true;
      this.confirmResetForm.reset();
      this.cdr.markForCheck();
    } catch (error: unknown) {
      await this.showError(
        this.i18n.translateError(error) || this.i18n.t('login.resetFailed')
      );
    } finally {
      await loading.dismiss();
    }
  }

  async submitPasswordResetConfirm(): Promise<void> {
    if (this.confirmResetForm.invalid) {
      this.confirmResetForm.markAllAsTouched();
      return;
    }

    const { code, newPassword, confirmPassword } = this.confirmResetForm.getRawValue();
    if (newPassword !== confirmPassword) {
      await this.showError(this.i18n.t('login.resetPasswordMismatch'));
      return;
    }

    const email = this.resetForm.getRawValue().email || '';
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('login.resetSaving') });
    await loading.present();

    try {
      await this.auth.confirmPasswordReset(email, code!, newPassword!);
      this.forgotPasswordMode = false;
      this.resetStep = 'email';
      this.resetForm.reset();
      this.confirmResetForm.reset();
      await loading.dismiss();

      const alert = await this.alertCtrl.create({
        header: this.i18n.t('login.resetDoneTitle'),
        message: this.i18n.t('login.resetDoneBody'),
        buttons: [this.i18n.t('ok')],
      });
      await alert.present();
      return;
    } catch (error: unknown) {
      await this.showError(
        this.i18n.translateError(error) || this.i18n.t('login.resetConfirmFailed')
      );
    } finally {
      await loading.dismiss();
    }
  }

  private async refreshBiometricAccess(): Promise<void> {
    this.biometricEnabled = await this.storage.isBiometricEnabled();
    this.showBiometricUnlock = await this.biometric.shouldShowUnlock();
    if (this.showBiometricUnlock && !String(this.form.getRawValue().identifier || '').trim()) {
      const creds = await this.storage.getBiometricCredentials();
      if (creds?.identifier) {
        this.form.patchValue({ identifier: creds.identifier });
      }
    }
    this.cdr.detectChanges();
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
            const { identifier, password } = this.form.getRawValue();
            if (identifier && password) {
              void this.biometric.enable(identifier, password);
            }
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

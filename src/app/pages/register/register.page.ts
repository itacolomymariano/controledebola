import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress } from '../../core/models/address.model';
import { MIN_PASSWORD_LENGTH } from '../../core/constants/auth.constants';
import { Subscription, merge } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppStorageService } from '../../core/services/app-storage.service';
import { PostAuthNavigationService } from '../../core/services/post-auth-navigation.service';
import Parse from 'parse';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { parseBirthDateIso } from '../../core/utils/birth-date.util';
import {
  emailFormatValidator,
  phoneFormatValidator,
} from '../../core/utils/contact-validation.util';

function emailOrPhoneValidator(control: AbstractControl): ValidationErrors | null {
  const email = control.get('email')?.value?.trim();
  const phone = control.get('phone')?.value?.trim();
  return email || phone ? null : { contactRequired: true };
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

function signupCaptchaValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { required: true };
  }
  return /^\d+$/.test(String(raw).trim()) ? null : { invalidCaptcha: true };
}

const LOCAL_SIGNUP_CHALLENGE_ID = 'local';
const SIGNUP_MIN_DURATION_MS = 8000;

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage implements OnInit, OnDestroy {
  canSubmit = false;
  showPassword = false;
  showConfirmPassword = false;
  signupChallengeQuestion = '';
  private signupStartedAt = new Date();
  private localSignupChallengeAnswer: number | null = null;
  private formSub?: Subscription;

  form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      apelido: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(30),
          Validators.pattern(/^[a-zA-Z0-9\u00C0-\u017F\s._-]+$/),
        ],
      ],
      email: ['', emailFormatValidator],
      phone: ['', phoneFormatValidator],
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
      birthDate: [''],
      address: [emptyAddress()],
      signupChallengeId: ['', Validators.required],
      signupCaptchaAnswer: ['', signupCaptchaValidator],
      signupHoneypot: [''],
    },
    { validators: [emailOrPhoneValidator, passwordMatchValidator] }
  );

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly storage: AppStorageService,
    private readonly postAuthNav: PostAuthNavigationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.signupStartedAt = new Date();
    this.loadLocalSignupChallenge();
    void this.tryUpgradeSignupChallenge();
    this.formSub = merge(this.form.statusChanges, this.form.valueChanges).subscribe(() => {
      this.refreshSubmitState();
    });
    this.refreshSubmitState();
  }

  private async tryUpgradeSignupChallenge(): Promise<void> {
    if (String(this.form.get('signupCaptchaAnswer')?.value ?? '').trim()) {
      return;
    }

    try {
      const result = await Parse.Cloud.run('prepareSignupChallenge');
      const challengeId = String(result?.challengeId || '');
      const question = String(result?.question || '');
      if (!challengeId || !question) {
        return;
      }
      this.signupChallengeQuestion = question;
      this.localSignupChallengeAnswer = null;
      this.form.patchValue({
        signupChallengeId: challengeId,
        signupCaptchaAnswer: '',
      });
      this.refreshSubmitState();
    } catch {
      // Mantem o desafio local ja carregado na abertura da tela.
    }
  }

  private loadLocalSignupChallenge(): void {
    const left = Math.floor(Math.random() * 8) + 1;
    const right = Math.floor(Math.random() * 8) + 1;
    this.localSignupChallengeAnswer = left + right;
    this.signupChallengeQuestion = `Quanto e ${left} + ${right}?`;
    this.form.patchValue({ signupChallengeId: LOCAL_SIGNUP_CHALLENGE_ID });
    this.refreshSubmitState();
  }

  private refreshSubmitState(): void {
    this.canSubmit = this.form.valid;
    this.cdr.markForCheck();
  }

  private validateLocalSignupAntiBot(): string | null {
    if (this.form.get('signupChallengeId')?.value !== LOCAL_SIGNUP_CHALLENGE_ID) {
      return null;
    }

    const honeypot = this.form.get('signupHoneypot')?.value?.trim();
    if (honeypot) {
      return 'Cadastro invalido.';
    }

    if (Date.now() - this.signupStartedAt.getTime() < SIGNUP_MIN_DURATION_MS) {
      return 'Cadastro muito rapido. Revise os dados e tente novamente.';
    }

    const answer = Number(this.form.get('signupCaptchaAnswer')?.value);
    if (Number.isNaN(answer) || answer !== this.localSignupChallengeAnswer) {
      return 'Resposta da verificacao incorreta.';
    }

    return null;
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  onAddressChanged(): void {
    this.form.get('address')?.updateValueAndValidity({ emitEvent: true });
    this.refreshSubmitState();
  }

  goLogin(): void {
    void this.router.navigateByUrl('/login');
  }

  async goBack(): Promise<void> {
    const wizardPath = await this.storage.getWizardPath();
    if (wizardPath) {
      void this.router.navigate(['/onboarding'], { queryParams: { step: 'participation' } });
      return;
    }
    void this.router.navigateByUrl('/login');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.get('address')?.hasError('addressIncomplete')) {
        await this.showError('Selecione seu endereco na lista de sugestoes para validar a localizacao.');
      }
      return;
    }

    const localAntiBotError = this.validateLocalSignupAntiBot();
    if (localAntiBotError) {
      await this.showError(localAntiBotError);
      return;
    }

    const v = this.form.getRawValue();
    const loading = await this.loadingCtrl.create({ message: 'Criando conta...' });
    await loading.present();

    try {
      await this.auth.register({
        name: v.name!.trim(),
        apelido: v.apelido!.trim(),
        email: v.email || undefined,
        phone: v.phone || undefined,
        password: v.password!,
        address: v.address!,
        birthDate: v.birthDate ? parseBirthDateIso(v.birthDate) ?? undefined : undefined,
        signupChallengeId: v.signupChallengeId || undefined,
        signupCaptchaAnswer: v.signupCaptchaAnswer ? Number(v.signupCaptchaAnswer) : undefined,
        signupStartedAt: this.signupStartedAt,
        signupHoneypot: v.signupHoneypot || undefined,
      });

      await this.storage.setOnboardingComplete();

      await this.offerBiometric();
      await this.postAuthNav.navigateAfterAuth();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      await loading.dismiss();
    }
  }

  private async offerBiometric(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Login rapido',
      message: 'Deseja ativar login por biometria neste dispositivo?',
      buttons: [
        { text: 'Agora nao', role: 'cancel' },
        { text: 'Ativar', handler: () => void this.storage.setBiometricEnabled(true) },
      ],
    });
    await alert.present();
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

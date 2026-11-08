import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress } from '../../core/models/address.model';
import { MIN_PASSWORD_LENGTH } from '../../core/constants/auth.constants';
import { formatAppReleaseFullLabel } from '../../core/constants/app-release-display.util';
import { Subscription, merge } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppStorageService } from '../../core/services/app-storage.service';
import { BiometricUnlockService } from '../../core/services/biometric-unlock.service';
import { PostAuthNavigationService } from '../../core/services/post-auth-navigation.service';
import { I18nService } from '../../core/services/i18n.service';
import Parse from 'parse';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { parseBirthDateIso } from '../../core/utils/birth-date.util';
import {
  emailFormatValidator,
  phoneFormatValidator,
} from '../../core/utils/contact-validation.util';
import { formatCpfMask, isValidCpf, normalizeCpfDigits } from '../../core/utils/cpf.util';
import { AddressFormComponent } from '../../shared/components/address-form/address-form.component';

export const REGISTER_WIZARD_STEPS = [
  'identity',
  'contact',
  'security',
  'location',
  'verify',
] as const;

export type RegisterWizardStep = (typeof REGISTER_WIZARD_STEPS)[number];

const STEP_FIELDS: Record<RegisterWizardStep, string[]> = {
  identity: ['name', 'apelido'],
  contact: ['email', 'cpf', 'phone'],
  security: ['password', 'confirmPassword'],
  location: ['birthDate', 'address'],
  verify: ['signupCaptchaAnswer'],
};

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

function cpfValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value || '').trim();
  if (!raw) return { required: true };
  return isValidCpf(raw) ? null : { invalidCpf: true };
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
  readonly appVersion = formatAppReleaseFullLabel();
  readonly wizardSteps = REGISTER_WIZARD_STEPS;

  currentStepIndex = 0;
  canSubmit = false;
  showPassword = false;
  showConfirmPassword = false;
  signupChallengeQuestion = '';

  private signupStartedAt = new Date();
  private localSignupChallengeAnswer: number | null = null;
  private formSub?: Subscription;
  private draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

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
      email: ['', [Validators.required, emailFormatValidator]],
      cpf: ['', [Validators.required, cpfValidator]],
      phone: ['', phoneFormatValidator],
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
      birthDate: [''],
      address: [emptyAddress()],
      signupChallengeId: ['', Validators.required],
      signupCaptchaAnswer: ['', signupCaptchaValidator],
      signupHoneypot: [''],
    },
    { validators: [passwordMatchValidator] }
  );

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

  get currentStep(): RegisterWizardStep {
    return this.wizardSteps[this.currentStepIndex];
  }

  get wizardProgress(): number {
    return (this.currentStepIndex + 1) / this.wizardSteps.length;
  }

  get isFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === this.wizardSteps.length - 1;
  }

  wizardProgressLabel(): string {
    return this.i18n.wizardProgress(
      'register.wizard.progress',
      this.currentStepIndex + 1,
      this.wizardSteps.length
    );
  }

  stepTitleKey(): string {
    return `register.wizard.step.${this.currentStep}.title`;
  }

  stepLeadKey(): string {
    return `register.wizard.step.${this.currentStep}.lead`;
  }

  ngOnInit(): void {
    this.signupStartedAt = new Date();
    this.loadLocalSignupChallenge();
    void this.tryUpgradeSignupChallenge();
    void this.restoreRegisterDraft();

    this.formSub = merge(this.form.statusChanges, this.form.valueChanges).subscribe(() => {
      this.refreshSubmitState();
      this.scheduleDraftSave();
    });
    this.refreshSubmitState();
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
  }

  @ViewChild(AddressFormComponent) private addressForm?: AddressFormComponent;

  goNext(): void {
    if (!this.validateCurrentStep()) {
      if (this.currentStep === 'location') {
        this.addressForm?.armIncompleteHint();
      }
      this.cdr.markForCheck();
      return;
    }
    this.addressForm?.resetIncompleteHint();
    if (this.currentStepIndex < this.wizardSteps.length - 1) {
      this.currentStepIndex += 1;
      void this.persistRegisterDraft();
      this.cdr.markForCheck();
    }
  }

  validateCurrentStep(): boolean {
    const step = this.currentStep;
    for (const name of STEP_FIELDS[step]) {
      this.form.get(name)?.markAsTouched();
      this.form.get(name)?.updateValueAndValidity();
    }
    if (step === 'security') {
      this.form.get('password')?.markAsTouched();
      this.form.get('confirmPassword')?.markAsTouched();
    }
    return this.isStepValid(step);
  }

  isStepValid(step: RegisterWizardStep): boolean {
    if (step === 'identity') {
      return this.form.get('name')!.valid && this.form.get('apelido')!.valid;
    }
    if (step === 'contact') {
      const phone = this.form.get('phone');
      const phoneOk = !phone?.value || phone.valid;
      return this.form.get('email')!.valid && this.form.get('cpf')!.valid && phoneOk;
    }
    if (step === 'security') {
      return (
        this.form.get('password')!.valid &&
        this.form.get('confirmPassword')!.valid &&
        !this.form.hasError('passwordMismatch')
      );
    }
    if (step === 'location') {
      const birth = this.form.get('birthDate');
      const birthOk = !birth?.value || birth.valid;
      return birthOk && this.form.get('address')!.valid;
    }
    if (step === 'verify') {
      return this.form.get('signupCaptchaAnswer')!.valid;
    }
    return false;
  }

  private async restoreRegisterDraft(): Promise<void> {
    const draft = await this.storage.getRegisterDraft();
    if (!draft) return;

    this.form.patchValue(
      {
        name: draft.name ?? '',
        apelido: draft.apelido ?? '',
        email: draft.email ?? '',
        cpf: draft.cpf ?? '',
        phone: draft.phone ?? '',
        birthDate: draft.birthDate ?? '',
        address: draft.address ?? emptyAddress(),
      },
      { emitEvent: false }
    );

    if (
      typeof draft.wizardStepIndex === 'number' &&
      draft.wizardStepIndex >= 0 &&
      draft.wizardStepIndex < this.wizardSteps.length
    ) {
      this.currentStepIndex = draft.wizardStepIndex;
    }
    this.refreshSubmitState();
    this.cdr.markForCheck();
  }

  private scheduleDraftSave(): void {
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => {
      void this.persistRegisterDraft();
    }, 400);
  }

  private async persistRegisterDraft(): Promise<void> {
    const v = this.form.getRawValue();
    await this.storage.setRegisterDraft({
      name: v.name ?? '',
      apelido: v.apelido ?? '',
      email: v.email ?? '',
      cpf: v.cpf ?? '',
      phone: v.phone ?? '',
      birthDate: v.birthDate ?? '',
      address: v.address ?? emptyAddress(),
      wizardStepIndex: this.currentStepIndex,
    });
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
      this.cdr.markForCheck();
    } catch {
      // Mantém o desafio local já carregado na abertura da tela.
    }
  }

  private loadLocalSignupChallenge(): void {
    const left = Math.floor(Math.random() * 8) + 1;
    const right = Math.floor(Math.random() * 8) + 1;
    this.localSignupChallengeAnswer = left + right;
    this.signupChallengeQuestion = this.i18n
      .t('register.captchaQuestion')
      .replace('{left}', String(left))
      .replace('{right}', String(right));
    this.form.patchValue({ signupChallengeId: LOCAL_SIGNUP_CHALLENGE_ID });
    this.refreshSubmitState();
  }

  private refreshSubmitState(): void {
    this.canSubmit = this.isLastStep && this.form.valid;
    this.cdr.markForCheck();
  }

  private validateLocalSignupAntiBot(): string | null {
    if (this.form.get('signupChallengeId')?.value !== LOCAL_SIGNUP_CHALLENGE_ID) {
      return null;
    }

    const honeypot = this.form.get('signupHoneypot')?.value?.trim();
    if (honeypot) {
      return this.i18n.t('register.signupInvalid');
    }

    if (Date.now() - this.signupStartedAt.getTime() < SIGNUP_MIN_DURATION_MS) {
      return this.i18n.t('register.signupTooFast');
    }

    const answer = Number(this.form.get('signupCaptchaAnswer')?.value);
    if (Number.isNaN(answer) || answer !== this.localSignupChallengeAnswer) {
      return this.i18n.t('register.captchaWrong');
    }

    return null;
  }

  onAddressChanged(): void {
    this.form.get('address')?.updateValueAndValidity({ emitEvent: true });
    this.refreshSubmitState();
  }

  async goLogin(): Promise<void> {
    await this.router.navigateByUrl('/login');
  }

  async goBack(): Promise<void> {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      void this.persistRegisterDraft();
      this.cdr.markForCheck();
      return;
    }
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
    if (!this.validateCurrentStep() || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.get('address')?.hasError('addressIncomplete')) {
        await this.showError(this.i18n.t('register.addressSubmitError'));
      }
      return;
    }

    const localAntiBotError = this.validateLocalSignupAntiBot();
    if (localAntiBotError) {
      await this.showError(localAntiBotError);
      return;
    }

    const v = this.form.getRawValue();
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('register.creatingAccount') });
    await loading.present();

    try {
      await this.auth.register({
        name: v.name!.trim(),
        apelido: v.apelido!.trim(),
        email: v.email || undefined,
        cpf: normalizeCpfDigits(String(v.cpf || '')),
        phone: v.phone || undefined,
        password: v.password!,
        address: v.address!,
        birthDate: v.birthDate ? parseBirthDateIso(v.birthDate) ?? undefined : undefined,
        signupChallengeId: v.signupChallengeId || undefined,
        signupCaptchaAnswer: v.signupCaptchaAnswer ? Number(v.signupCaptchaAnswer) : undefined,
        signupStartedAt: this.signupStartedAt,
        signupHoneypot: v.signupHoneypot || undefined,
      });

      await this.storage.clearRegisterDraft();
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
      header: this.i18n.t('register.biometricTitle'),
      message: this.i18n.t('register.biometricMessage'),
      buttons: [
        { text: this.i18n.t('register.biometricLater'), role: 'cancel' },
        {
          text: this.i18n.t('register.biometricEnable'),
          handler: () => {
            const { email, password } = this.form.getRawValue();
            if (email && password) {
              void this.biometric.enable(email, password);
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

  onCpfInput(event: CustomEvent): void {
    const raw = String((event.detail as { value?: string })?.value || '');
    const masked = formatCpfMask(raw);
    this.form.get('cpf')?.setValue(masked, { emitEvent: true });
    this.form.get('cpf')?.updateValueAndValidity({ emitEvent: false });
  }
}

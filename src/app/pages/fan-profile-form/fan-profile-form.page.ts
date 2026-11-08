import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { FanProfileService } from '../../core/services/fan-profile.service';
import { I18nService } from '../../core/services/i18n.service';
import {
  clearFormDraft,
  FAN_PROFILE_FORM_DRAFT_KEY,
  readFormDraft,
  writeFormDraft,
} from '../../core/utils/form-draft.util';

const FAN_WIZARD_STEPS = ['pelada', 'match', 'extra'] as const;
type FanWizardStep = (typeof FAN_WIZARD_STEPS)[number];

interface FanFormDraft {
  stepIndex: number;
  values: Record<string, unknown>;
}

@Component({
  selector: 'app-fan-profile-form',
  templateUrl: './fan-profile-form.page.html',
  styleUrls: ['./fan-profile-form.page.scss'],
  standalone: false,
})
export class FanProfileFormPage {
  hasProfile = false;
  displayName = '';
  apelido = '';
  avatarUrl: string | null = null;

  readonly wizardSteps = FAN_WIZARD_STEPS;
  currentStepIndex = 0;

  form = this.fb.group({
    peladaPresentialRate: [null as number | null],
    peladaRemoteRate: [null as number | null],
    matchPresentialRate: [null as number | null],
    matchRemoteRate: [null as number | null],
    acceptsPaidCommitments: [false],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly fanProfileService: FanProfileService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get wizardStep(): FanWizardStep {
    return this.wizardSteps[this.currentStepIndex];
  }

  get wizardProgress(): number {
    return (this.currentStepIndex + 1) / this.wizardSteps.length;
  }

  get wizardProgressLabel(): string {
    return this.i18n.wizardProgress(
      'fanProfileForm.wizard.progress',
      this.currentStepIndex + 1,
      this.wizardSteps.length
    );
  }

  get wizardStepHelpKey(): string {
    return `fanProfileForm.wizard.step.${this.wizardStep}.help`;
  }

  get wizardStepTitle(): string {
    return this.i18n.t(`fanProfileForm.wizard.step.${this.wizardStep}.title`);
  }

  get wizardStepLead(): string {
    return this.i18n.t(`fanProfileForm.wizard.step.${this.wizardStep}.lead`);
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.auth.isLoggedIn()) {
      await this.auth.fetchCurrentUser();
    }

    this.displayName = this.auth.getDisplayName();
    const user = this.auth.getCurrentUser();
    this.apelido = (user?.get('apelido') as string) || '';
    this.avatarUrl = this.auth.getAvatarUrl();

    const profile = await this.fanProfileService.getForCurrentUser();
    this.hasProfile = !!profile;
    if (profile) {
      this.form.patchValue({
        peladaPresentialRate: profile.peladaPresentialRate ?? null,
        peladaRemoteRate: profile.peladaRemoteRate ?? null,
        matchPresentialRate: profile.matchPresentialRate ?? null,
        matchRemoteRate: profile.matchRemoteRate ?? null,
        acceptsPaidCommitments: !!profile.acceptsPaidCommitments,
      });
    } else {
      this.restoreDraft();
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }

  async exitWizard(): Promise<void> {
    this.persistDraft();
    const alert = await this.alertCtrl.create({
      header: 'Sair do cadastro',
      message: 'Seu rascunho foi salvo neste aparelho. Você pode continuar depois.',
      buttons: [
        { text: 'Continuar preenchendo', role: 'cancel' },
        { text: 'Sair', role: 'destructive', handler: () => this.cancel() },
      ],
    });
    await alert.present();
  }

  goWizardNext(): void {
    if (this.currentStepIndex < this.wizardSteps.length - 1) {
      this.currentStepIndex += 1;
      this.persistDraft();
      this.cdr.markForCheck();
    }
  }

  goWizardBack(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      this.persistDraft();
      this.cdr.markForCheck();
    }
  }

  wizardSubmit(): void {
    void this.submit();
  }

  async submit(): Promise<void> {
    const v = this.form.getRawValue();
    const loading = await this.loadingCtrl.create({ message: 'Salvando perfil...' });
    await loading.present();

    try {
      const payload = {
        peladaPresentialRate: v.peladaPresentialRate != null ? Number(v.peladaPresentialRate) : undefined,
        peladaRemoteRate: v.peladaRemoteRate != null ? Number(v.peladaRemoteRate) : undefined,
        matchPresentialRate: v.matchPresentialRate != null ? Number(v.matchPresentialRate) : undefined,
        matchRemoteRate: v.matchRemoteRate != null ? Number(v.matchRemoteRate) : undefined,
        acceptsPaidCommitments: !!v.acceptsPaidCommitments,
      };

      if (this.hasProfile) {
        await this.fanProfileService.update(payload);
      } else {
        await this.fanProfileService.create(payload);
        clearFormDraft(FAN_PROFILE_FORM_DRAFT_KEY);
        this.hasProfile = true;
      }

      const alert = await this.alertCtrl.create({
        header: 'Perfil salvo',
        message: 'Seu perfil de torcedor foi atualizado.',
        buttons: ['OK'],
      });
      await alert.present();
      void this.router.navigateByUrl('/tabs/profile');
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
    } finally {
      await loading.dismiss();
    }
  }

  private restoreDraft(): void {
    const draft = readFormDraft<FanFormDraft>(FAN_PROFILE_FORM_DRAFT_KEY);
    if (!draft?.values) return;
    this.currentStepIndex = Math.min(
      Math.max(0, draft.stepIndex ?? 0),
      this.wizardSteps.length - 1
    );
    this.form.patchValue(draft.values);
  }

  private persistDraft(): void {
    if (this.hasProfile) return;
    writeFormDraft<FanFormDraft>(FAN_PROFILE_FORM_DRAFT_KEY, {
      stepIndex: this.currentStepIndex,
      values: this.form.getRawValue() as Record<string, unknown>,
    });
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

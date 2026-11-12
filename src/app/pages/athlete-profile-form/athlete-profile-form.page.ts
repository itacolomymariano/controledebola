import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  AthleteFootPreference,
  AthleteMaritalStatus,
  heightCmToParts,
  partsToHeightCm,
} from '../../core/models/athlete-profile.model';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { I18nService } from '../../core/services/i18n.service';
import { WizardTourService } from '../../core/services/wizard-tour.service';
import {
  ATHLETE_PROFILE_FORM_DRAFT_KEY,
  clearFormDraft,
  readFormDraft,
  writeFormDraft,
} from '../../core/utils/form-draft.util';
import { AthletePlayedTeamLink, AthletePlayedTeamPick } from '../../core/models/athlete-played-team.model';
import {
  addPlayedTeamPick,
  playedTeamLinksFromAthleteProfile,
  teamNamesFromLinks,
} from '../../core/utils/athlete-played-team.util';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';

const ATHLETE_WIZARD_STEPS = ['positions', 'measures', 'extras', 'teams'] as const;
type AthleteWizardStep = (typeof ATHLETE_WIZARD_STEPS)[number];

interface AthleteFormDraft {
  stepIndex: number;
  values: Record<string, unknown>;
}

@Component({
  selector: 'app-athlete-profile-form',
  templateUrl: './athlete-profile-form.page.html',
  styleUrls: ['./athlete-profile-form.page.scss'],
  standalone: false,
})
export class AthleteProfileFormPage {
  hasProfile = false;
  teamPickerOpen = false;
  playedTeamLinks: AthletePlayedTeamLink[] = [];
  readonly teamPickerReturnUrl = '/athlete-profile-form';

  readonly wizardSteps = ATHLETE_WIZARD_STEPS;
  currentStepIndex = 0;

  form = this.fb.group({
    primaryPosition: ['', Validators.required],
    secondaryPosition: [''],
    thirdPosition: [''],
    shoeSize: [null as number | null, Validators.required],
    heightMeter: [null as number | null, Validators.required],
    heightCm: [null as number | null, Validators.required],
    weight: [null as number | null, Validators.required],
    footPreference: [''],
    maritalStatus: [''],
    peladaRate: [null as number | null],
    teamMatchRate: [null as number | null],
    playedAmateurTeams: [[] as string[]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly wizardTour: WizardTourService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get playedAmateurTeams(): string[] {
    return this.form.get('playedAmateurTeams')?.value ?? [];
  }

  get wizardStep(): AthleteWizardStep {
    return this.wizardSteps[this.currentStepIndex];
  }

  get wizardProgress(): number {
    return (this.currentStepIndex + 1) / this.wizardSteps.length;
  }

  get wizardProgressLabel(): string {
    return this.i18n.wizardProgress(
      'athleteProfileForm.wizard.progress',
      this.currentStepIndex + 1,
      this.wizardSteps.length
    );
  }

  get wizardStepHelpKey(): string {
    return `athleteProfileForm.wizard.step.${this.wizardStep}.help`;
  }

  get wizardStepTitle(): string {
    return this.i18n.t(`athleteProfileForm.wizard.step.${this.wizardStep}.title`);
  }

  get wizardStepLead(): string {
    return this.i18n.t(`athleteProfileForm.wizard.step.${this.wizardStep}.lead`);
  }

  async ionViewWillEnter(): Promise<void> {
    const profile = await this.athleteProfileService.getForCurrentUser();
    this.hasProfile = !!profile;
    if (profile) {
      const { meter, centimeters } = heightCmToParts(profile.height);
      this.form.patchValue({
        primaryPosition: profile.primaryPosition,
        secondaryPosition: profile.secondaryPosition ?? '',
        thirdPosition: profile.thirdPosition ?? '',
        shoeSize: profile.shoeSize,
        heightMeter: meter,
        heightCm: centimeters,
        weight: profile.weight,
        footPreference: profile.footPreference ?? '',
        maritalStatus: profile.maritalStatus ?? '',
        peladaRate: profile.peladaRate ?? null,
        teamMatchRate: profile.teamMatchRate ?? null,
        playedAmateurTeams: profile.playedAmateurTeams ?? [],
      });
      this.playedTeamLinks = playedTeamLinksFromAthleteProfile(profile);
    } else {
      this.restoreDraft();
      this.cdr.markForCheck();
    }
  }

  openTeamPicker(): void {
    this.teamPickerOpen = true;
  }

  closeTeamPicker(): void {
    this.teamPickerOpen = false;
  }

  onTeamPicked(value: string | AthletePlayedTeamPick): void {
    this.playedTeamLinks = addPlayedTeamPick(this.playedTeamLinks, value);
    this.syncPlayedTeamsForm();
    this.closeTeamPicker();
    this.cdr.markForCheck();
  }

  onPlayedTeamLinksChange(links: AthletePlayedTeamLink[]): void {
    this.playedTeamLinks = links;
    this.syncPlayedTeamsForm();
    this.cdr.markForCheck();
  }

  private syncPlayedTeamsForm(): void {
    this.form.patchValue({ playedAmateurTeams: teamNamesFromLinks(this.playedTeamLinks) });
    this.persistDraft();
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
    if (!this.validateWizardStep()) {
      this.cdr.markForCheck();
      return;
    }
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

  validateWizardStep(): boolean {
    const step = this.wizardStep;
    if (step === 'positions') {
      this.form.get('primaryPosition')?.markAsTouched();
      return this.form.get('primaryPosition')!.valid;
    }
    if (step === 'measures') {
      ['shoeSize', 'heightMeter', 'heightCm', 'weight'].forEach((key) =>
        this.form.get(key)?.markAsTouched()
      );
      return (
        this.form.get('shoeSize')!.valid &&
        this.form.get('heightMeter')!.valid &&
        this.form.get('heightCm')!.valid &&
        this.form.get('weight')!.valid
      );
    }
    return true;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.form, {
        primaryPosition: 'Posicao principal',
        shoeSize: 'Numero do pe',
        heightMeter: 'Altura (metros)',
        heightCm: 'Altura (centimetros)',
        weight: 'Peso',
      });
      if (message) await this.showError(message);
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: this.hasProfile ? 'Salvando alteracoes...' : 'Salvando...',
    });
    await loading.present();

    try {
      const v = this.form.getRawValue();
      const payload = {
        primaryPosition: v.primaryPosition!,
        secondaryPosition: v.secondaryPosition || undefined,
        thirdPosition: v.thirdPosition || undefined,
        shoeSize: Number(v.shoeSize),
        height: partsToHeightCm(Number(v.heightMeter), Number(v.heightCm)),
        weight: Number(v.weight),
        footPreference: this.normalizeFootPreference(v.footPreference),
        maritalStatus: this.normalizeMaritalStatus(v.maritalStatus),
        peladaRate: v.peladaRate != null ? Number(v.peladaRate) : undefined,
        teamMatchRate: v.teamMatchRate != null ? Number(v.teamMatchRate) : undefined,
        playedAmateurTeams: teamNamesFromLinks(this.playedTeamLinks),
        playedTeamLinks: this.playedTeamLinks,
      };

      if (this.hasProfile) {
        await this.athleteProfileService.update(payload);
      } else {
        await this.athleteProfileService.create(payload);
        clearFormDraft(ATHLETE_PROFILE_FORM_DRAFT_KEY);
      }
      this.wizardTour.completePendingStep();
      await this.router.navigateByUrl('/tabs/profile', { replaceUrl: true });
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Nao foi possivel salvar.');
    } finally {
      await loading.dismiss();
    }
  }

  private restoreDraft(): void {
    const draft = readFormDraft<AthleteFormDraft>(ATHLETE_PROFILE_FORM_DRAFT_KEY);
    if (!draft?.values) return;
    this.currentStepIndex = Math.min(
      Math.max(0, draft.stepIndex ?? 0),
      this.wizardSteps.length - 1
    );
    this.form.patchValue(draft.values);
  }

  private persistDraft(): void {
    if (this.hasProfile) return;
    writeFormDraft<AthleteFormDraft>(ATHLETE_PROFILE_FORM_DRAFT_KEY, {
      stepIndex: this.currentStepIndex,
      values: this.form.getRawValue() as Record<string, unknown>,
    });
  }

  private normalizeFootPreference(value: unknown): AthleteFootPreference | undefined {
    if (value === 'destro' || value === 'ambidestro' || value === 'canhoto') return value;
    return undefined;
  }

  private normalizeMaritalStatus(value: unknown): AthleteMaritalStatus | undefined {
    if (value === 'casado' || value === 'solteiro') return value;
    return undefined;
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

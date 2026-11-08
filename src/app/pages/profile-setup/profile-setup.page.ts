import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription, merge } from 'rxjs';
import { partsToHeightCm } from '../../core/models/athlete-profile.model';
import {
  EVENT_REGISTRATION_ROLES,
  PROFILE_ROLE_LABELS,
  ProfileRole,
} from '../../core/models/profile-role.model';
import {
  ProfessionalRole,
  ROLE_PROFILE_FIELDS,
  RoleProfileFieldDef,
  buildRoleProfileForm,
  isProfessionalRole,
  payloadFromRoleProfileForm,
  roleProfileFieldLabels,
} from '../../core/models/role-profile.model';
import { formatAppReleaseFullLabel } from '../../core/constants/app-release-display.util';
import { WizardPath } from '../../core/models/wizard.model';
import { AppStorageService } from '../../core/services/app-storage.service';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { FanProfileService } from '../../core/services/fan-profile.service';
import { I18nService } from '../../core/services/i18n.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';
import { AthleteProfileFieldsSection } from '../../shared/components/athlete-profile-fields/athlete-profile-fields.component';
import { RoleProfileFieldsSection } from '../../shared/components/role-profile-fields/role-profile-fields.component';
import { PlayfulCardTone } from '../../shared/components/playful-card/playful-card.component';

type OtherSetupStep = 'pick' | 'form' | 'fan';
type AthleteSetupStep = 'positions' | 'measures' | 'extras';
type FanSetupStep = 'fanPelada' | 'fanMatch';
type ProSetupStep = 'proRates' | 'proPix' | 'proGear';

const ATHLETE_STEPS: AthleteSetupStep[] = ['positions', 'measures', 'extras'];
const FAN_STEPS: FanSetupStep[] = ['fanPelada', 'fanMatch'];

@Component({
  selector: 'app-profile-setup',
  templateUrl: './profile-setup.page.html',
  styleUrls: ['./profile-setup.page.scss'],
  standalone: false,
})
export class ProfileSetupPage implements OnDestroy {
  readonly appVersion = formatAppReleaseFullLabel();

  loading = true;
  wizardPath: WizardPath | null = null;
  selectedRole: ProfileRole | null = null;
  otherStep: OtherSetupStep = 'pick';
  otherForm: FormGroup = this.fb.group({});

  athleteStepIndex = 0;
  fanStepIndex = 0;
  proStepIndex = 0;
  proSteps: ProSetupStep[] = [];

  otherRoles = EVENT_REGISTRATION_ROLES.filter((role) => role !== 'athlete').map((value) => ({
    value,
    label: PROFILE_ROLE_LABELS[value],
  }));

  private readonly rolePlayfulTones: PlayfulCardTone[] = ['peladas', 'confrontos', 'times', 'users'];

  rolePlayfulTone(index: number): PlayfulCardTone {
    return this.rolePlayfulTones[index % this.rolePlayfulTones.length];
  }

  athleteForm = this.fb.group({
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
  });

  fanForm = this.fb.group({
    peladaPresentialRate: [null as number | null],
    peladaRemoteRate: [null as number | null],
    matchPresentialRate: [null as number | null],
    matchRemoteRate: [null as number | null],
    acceptsPaidCommitments: [false],
  });

  private formSub?: Subscription;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly storage: AppStorageService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly fanProfileService: FanProfileService,
    private readonly roleProfileService: RoleProfileService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get selectedRoleLabel(): string {
    return this.selectedRole ? PROFILE_ROLE_LABELS[this.selectedRole] : '';
  }

  get isProfessionalSelected(): boolean {
    return !!this.selectedRole && isProfessionalRole(this.selectedRole);
  }

  get professionalRole(): ProfessionalRole | null {
    return this.selectedRole && isProfessionalRole(this.selectedRole) ? this.selectedRole : null;
  }

  get showWizardProgress(): boolean {
    if (this.loading) return false;
    if (this.wizardPath === 'athlete') return true;
    if (this.wizardPath === 'other' && this.otherStep === 'fan') return true;
    if (this.wizardPath === 'other' && this.otherStep === 'form' && this.proSteps.length > 0) return true;
    return false;
  }

  get wizardProgress(): number {
    const total = this.wizardStepTotal;
    if (total <= 0) return 0;
    return (this.wizardStepCurrent + 1) / total;
  }

  get wizardStepCurrent(): number {
    if (this.wizardPath === 'athlete') return this.athleteStepIndex;
    if (this.otherStep === 'fan') return this.fanStepIndex;
    if (this.otherStep === 'form') return this.proStepIndex;
    return 0;
  }

  get wizardStepTotal(): number {
    if (this.wizardPath === 'athlete') return ATHLETE_STEPS.length;
    if (this.otherStep === 'fan') return FAN_STEPS.length;
    if (this.otherStep === 'form') return this.proSteps.length;
    return 0;
  }

  get isFirstWizardStep(): boolean {
    return this.wizardStepCurrent <= 0;
  }

  get isLastWizardStep(): boolean {
    return this.wizardStepCurrent >= this.wizardStepTotal - 1;
  }

  get currentAthleteStep(): AthleteSetupStep {
    return ATHLETE_STEPS[this.athleteStepIndex];
  }

  get currentAthleteSection(): AthleteProfileFieldsSection {
    return this.currentAthleteStep;
  }

  get currentFanStep(): FanSetupStep {
    return FAN_STEPS[this.fanStepIndex];
  }

  get currentProStep(): ProSetupStep | null {
    return this.proSteps[this.proStepIndex] ?? null;
  }

  get currentProSection(): RoleProfileFieldsSection {
    const step = this.currentProStep;
    if (step === 'proRates') return 'rates';
    if (step === 'proPix') return 'pix';
    return 'gear';
  }

  wizardProgressLabel(): string {
    return this.i18n.wizardProgress(
      'profileSetup.wizard.progress',
      this.wizardStepCurrent + 1,
      this.wizardStepTotal
    );
  }

  stepTitleKey(): string {
    if (this.wizardPath === 'athlete') {
      return `profileSetup.wizard.step.${this.currentAthleteStep}.title`;
    }
    if (this.otherStep === 'fan') {
      return `profileSetup.wizard.step.${this.currentFanStep}.title`;
    }
    if (this.currentProStep) {
      return `profileSetup.wizard.step.${this.currentProStep}.title`;
    }
    return '';
  }

  stepLeadKey(): string {
    if (this.wizardPath === 'athlete') {
      return `profileSetup.wizard.step.${this.currentAthleteStep}.lead`;
    }
    if (this.otherStep === 'fan') {
      return `profileSetup.wizard.step.${this.currentFanStep}.lead`;
    }
    if (this.currentProStep) {
      return `profileSetup.wizard.step.${this.currentProStep}.lead`;
    }
    return '';
  }

  stepHintKey(): string {
    if (this.wizardPath === 'athlete') {
      const map: Record<AthleteSetupStep, string> = {
        positions: 'profileSetup.hint.positions',
        measures: 'profileSetup.hint.measures',
        extras: 'profileSetup.hint.extras',
      };
      return map[this.currentAthleteStep];
    }
    if (this.otherStep === 'fan') {
      return this.currentFanStep === 'fanPelada'
        ? 'profileSetup.hint.fanPelada'
        : 'profileSetup.hint.fanMatch';
    }
    if (this.currentProStep === 'proRates') return 'profileSetup.hint.proRates';
    if (this.currentProStep === 'proPix') return 'profileSetup.hint.proPix';
    if (this.currentProStep === 'proGear') return 'profileSetup.hint.proGear';
    return '';
  }

  proTitle(): string {
    return this.i18n.t('profileSetup.proTitle').replace('{role}', this.selectedRoleLabel);
  }

  async ionViewWillEnter(): Promise<void> {
    this.wizardPath = await this.storage.getWizardPath();
    if (!this.wizardPath) {
      await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
      return;
    }
    this.loading = false;
    await this.restoreDraft();
    this.formSub = merge(
      this.athleteForm.valueChanges,
      this.fanForm.valueChanges,
      this.otherForm.valueChanges
    ).subscribe(() => this.scheduleDraftSave());
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }

  selectRole(role: ProfileRole): void {
    this.selectedRole = role;
    this.otherStep = 'pick';
    this.otherForm = this.fb.group({});
    this.scheduleDraftSave();
  }

  continueOtherProfile(): void {
    if (!this.selectedRole) return;

    if (this.selectedRole === 'fan') {
      this.otherStep = 'fan';
      this.fanStepIndex = 0;
      this.scheduleDraftSave();
      this.cdr.markForCheck();
      return;
    }

    if (isProfessionalRole(this.selectedRole)) {
      this.otherForm = buildRoleProfileForm(this.fb, this.selectedRole);
      this.proSteps = this.buildProSteps(this.selectedRole);
      this.proStepIndex = 0;
      this.otherStep = 'form';
      this.scheduleDraftSave();
      this.cdr.markForCheck();
    }
  }

  goWizardNext(): void {
    if (!this.validateCurrentWizardStep()) return;

    if (this.wizardPath === 'athlete') {
      if (this.athleteStepIndex < ATHLETE_STEPS.length - 1) {
        this.athleteStepIndex += 1;
      } else {
        void this.saveAthleteProfile();
        return;
      }
    } else if (this.otherStep === 'fan') {
      if (this.fanStepIndex < FAN_STEPS.length - 1) {
        this.fanStepIndex += 1;
      } else {
        void this.saveOtherProfile();
        return;
      }
    } else if (this.otherStep === 'form') {
      if (this.proStepIndex < this.proSteps.length - 1) {
        this.proStepIndex += 1;
      } else {
        void this.saveOtherProfile();
        return;
      }
    }

    void this.persistDraft();
    this.cdr.markForCheck();
  }

  goWizardBack(): void {
    if (this.wizardPath === 'athlete' && this.athleteStepIndex > 0) {
      this.athleteStepIndex -= 1;
    } else if (this.otherStep === 'fan' && this.fanStepIndex > 0) {
      this.fanStepIndex -= 1;
    } else if (this.otherStep === 'form' && this.proStepIndex > 0) {
      this.proStepIndex -= 1;
    } else if (this.otherStep === 'fan' || this.otherStep === 'form') {
      this.backToRolePick();
      return;
    }
    void this.persistDraft();
    this.cdr.markForCheck();
  }

  validateCurrentWizardStep(): boolean {
    if (this.wizardPath === 'athlete') {
      return this.validateAthleteStep(this.currentAthleteStep);
    }
    if (this.otherStep === 'fan') {
      return true;
    }
    if (this.otherStep === 'form' && this.selectedRole && isProfessionalRole(this.selectedRole)) {
      return this.validateProStep(this.currentProSection, this.selectedRole);
    }
    return true;
  }

  private validateAthleteStep(step: AthleteSetupStep): boolean {
    const keys =
      step === 'positions'
        ? ['primaryPosition']
        : step === 'measures'
          ? ['shoeSize', 'heightMeter', 'heightCm', 'weight']
          : ['footPreference', 'maritalStatus', 'peladaRate', 'teamMatchRate'];
    for (const key of keys) {
      const c = this.athleteForm.get(key);
      c?.markAsTouched();
      c?.updateValueAndValidity();
    }
    if (step === 'positions') return this.athleteForm.get('primaryPosition')!.valid;
    if (step === 'measures') {
      return (
        this.athleteForm.get('shoeSize')!.valid &&
        this.athleteForm.get('heightMeter')!.valid &&
        this.athleteForm.get('heightCm')!.valid &&
        this.athleteForm.get('weight')!.valid
      );
    }
    return true;
  }

  private validateProStep(section: RoleProfileFieldsSection, role: ProfessionalRole): boolean {
    const fields = ROLE_PROFILE_FIELDS[role].filter((f) => this.fieldInSection(f, section));
    let ok = true;
    for (const field of fields) {
      if (!this.showProField(field)) continue;
      const c = this.otherForm.get(field.key);
      c?.markAsTouched();
      c?.updateValueAndValidity();
      if (field.required && c?.invalid) ok = false;
    }
    return ok;
  }

  private showProField(field: RoleProfileFieldDef): boolean {
    if (field.key === 'federationName' || field.key === 'federationRegistrationNumber') {
      return !!this.otherForm.get('isFederatedReferee')?.value;
    }
    return true;
  }

  private fieldInSection(field: RoleProfileFieldDef, section: RoleProfileFieldsSection): boolean {
    if (section === 'rates') return field.type === 'money';
    if (section === 'pix') return field.type === 'pix';
    if (field.type === 'money' || field.type === 'pix') return false;
    return true;
  }

  private buildProSteps(role: ProfessionalRole): ProSetupStep[] {
    const fields = ROLE_PROFILE_FIELDS[role];
    const steps: ProSetupStep[] = [];
    if (fields.some((f) => f.type === 'money')) steps.push('proRates');
    if (fields.some((f) => f.type === 'pix')) steps.push('proPix');
    if (fields.some((f) => f.type !== 'money' && f.type !== 'pix')) steps.push('proGear');
    return steps.length ? steps : ['proGear'];
  }

  backToRolePick(): void {
    this.otherStep = 'pick';
    this.fanStepIndex = 0;
    this.proStepIndex = 0;
    this.scheduleDraftSave();
    this.cdr.markForCheck();
  }

  async saveAthleteProfile(): Promise<void> {
    if (!this.validateAthleteStep('positions') || !this.validateAthleteStep('measures')) {
      this.athleteForm.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.athleteForm, this.athleteFieldLabels());
      if (message) await this.showError(message);
      return;
    }

    const loading = await this.loadingCtrl.create({ message: this.i18n.t('profileSetup.savingProfile') });
    await loading.present();

    try {
      const v = this.athleteForm.getRawValue();
      await this.athleteProfileService.create({
        primaryPosition: v.primaryPosition!,
        secondaryPosition: v.secondaryPosition || undefined,
        thirdPosition: v.thirdPosition || undefined,
        shoeSize: Number(v.shoeSize),
        height: partsToHeightCm(Number(v.heightMeter), Number(v.heightCm)),
        weight: Number(v.weight),
        maritalStatus:
          v.maritalStatus === 'casado' || v.maritalStatus === 'solteiro'
            ? v.maritalStatus
            : undefined,
        footPreference: v.footPreference ? (v.footPreference as never) : undefined,
        peladaRate: v.peladaRate != null ? Number(v.peladaRate) : undefined,
        teamMatchRate: v.teamMatchRate != null ? Number(v.teamMatchRate) : undefined,
      });
      await this.auth.setPrimaryRole('athlete');
      await this.finishSetup();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : this.i18n.t('profileSetup.saveError'));
    } finally {
      await loading.dismiss();
    }
  }

  async saveOtherProfile(): Promise<void> {
    if (!this.selectedRole) {
      await this.showError(this.i18n.t('profileSetup.selectRoleError'));
      return;
    }

    if (this.selectedRole === 'fan') {
      await this.saveFanProfile();
      return;
    }

    if (!isProfessionalRole(this.selectedRole)) return;

    if (this.otherForm.invalid) {
      this.otherForm.markAllAsTouched();
      const message = buildMissingFieldsMessage(
        this.otherForm,
        roleProfileFieldLabels(this.selectedRole as ProfessionalRole)
      );
      if (message) await this.showError(message);
      return;
    }

    const loading = await this.loadingCtrl.create({ message: this.i18n.t('profileSetup.saving') });
    await loading.present();

    try {
      await this.roleProfileService.create(
        payloadFromRoleProfileForm(this.selectedRole, this.otherForm.getRawValue())
      );
      await this.auth.setPrimaryRole(this.selectedRole);
      await this.finishSetup();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : this.i18n.t('profileSetup.saveError'));
    } finally {
      await loading.dismiss();
    }
  }

  private async saveFanProfile(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('profileSetup.saving') });
    await loading.present();

    try {
      const v = this.fanForm.getRawValue();
      await this.fanProfileService.create({
        peladaPresentialRate: v.peladaPresentialRate != null ? Number(v.peladaPresentialRate) : undefined,
        peladaRemoteRate: v.peladaRemoteRate != null ? Number(v.peladaRemoteRate) : undefined,
        matchPresentialRate: v.matchPresentialRate != null ? Number(v.matchPresentialRate) : undefined,
        matchRemoteRate: v.matchRemoteRate != null ? Number(v.matchRemoteRate) : undefined,
        acceptsPaidCommitments: !!v.acceptsPaidCommitments,
      });
      await this.auth.setPrimaryRole('fan');
      await this.finishSetup();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : this.i18n.t('profileSetup.saveError'));
    } finally {
      await loading.dismiss();
    }
  }

  async skip(): Promise<void> {
    await this.finishSetup();
  }

  private async finishSetup(): Promise<void> {
    await this.storage.clearProfileSetupDraft();
    await this.storage.setProfileWizardComplete();
    await this.storage.clearWizardPath();
    await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
  }

  private athleteFieldLabels(): Record<string, string> {
    return {
      primaryPosition: this.i18n.t('athleteProfile.primaryPosition'),
      shoeSize: this.i18n.t('athleteProfile.shoeSize'),
      heightMeter: this.i18n.t('athleteProfile.heightMeter'),
      heightCm: this.i18n.t('athleteProfile.heightCm'),
      weight: this.i18n.t('athleteProfile.weight'),
    };
  }

  private scheduleDraftSave(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => void this.persistDraft(), 400);
  }

  private async persistDraft(): Promise<void> {
    await this.storage.setProfileSetupDraft({
      wizardPath: this.wizardPath,
      otherStep: this.otherStep,
      selectedRole: this.selectedRole,
      athleteStepIndex: this.athleteStepIndex,
      fanStepIndex: this.fanStepIndex,
      proStepIndex: this.proStepIndex,
      athleteForm: this.athleteForm.getRawValue() as Record<string, unknown>,
      fanForm: this.fanForm.getRawValue() as Record<string, unknown>,
      otherForm: this.otherForm.getRawValue() as Record<string, unknown>,
    });
  }

  private async restoreDraft(): Promise<void> {
    const draft = await this.storage.getProfileSetupDraft();
    if (!draft) return;

    if (draft.selectedRole) this.selectedRole = draft.selectedRole as ProfileRole;
    if (draft.otherStep === 'pick' || draft.otherStep === 'form' || draft.otherStep === 'fan') {
      this.otherStep = draft.otherStep;
    }
    if (typeof draft.athleteStepIndex === 'number') this.athleteStepIndex = draft.athleteStepIndex;
    if (typeof draft.fanStepIndex === 'number') this.fanStepIndex = draft.fanStepIndex;

    if (draft.athleteForm) this.athleteForm.patchValue(draft.athleteForm, { emitEvent: false });

    if (draft.fanForm) this.fanForm.patchValue(draft.fanForm, { emitEvent: false });

    if (this.selectedRole && isProfessionalRole(this.selectedRole) && this.otherStep === 'form') {
      this.otherForm = buildRoleProfileForm(this.fb, this.selectedRole);
      this.proSteps = this.buildProSteps(this.selectedRole);
      if (draft.otherForm) this.otherForm.patchValue(draft.otherForm, { emitEvent: false });
      if (typeof draft.proStepIndex === 'number') this.proStepIndex = draft.proStepIndex;
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

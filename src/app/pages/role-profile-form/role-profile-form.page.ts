import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  ProfessionalRole,
  ROLE_HISTORY_MODE,
  ROLE_PROFILE_FIELDS,
  RoleProfileWizardStepId,
  buildRoleProfileForm,
  isProfessionalRole,
  patchRoleProfileForm,
  payloadFromRoleProfileForm,
  roleProfileFieldLabels,
  roleProfileWizardSteps,
} from '../../core/models/role-profile.model';
import { RoleParticipationHistory } from '../../core/models/role-participation-history.model';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../../core/models/profile-role.model';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { RoleProfileHistoryService } from '../../core/services/role-profile-history.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import {
  ROLE_PROFILE_FORM_DRAFT_KEY,
  clearFormDraft,
  readFormDraft,
  writeFormDraft,
} from '../../core/utils/form-draft.util';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

interface RoleProfileFormDraft {
  role: ProfessionalRole;
  stepIndex: number;
  values: Record<string, unknown>;
}

@Component({
  selector: 'app-role-profile-form',
  templateUrl: './role-profile-form.page.html',
  styleUrls: ['./role-profile-form.page.scss'],
  standalone: false,
})
export class RoleProfileFormPage {
  role: ProfessionalRole | null = null;
  roleLabel = '';
  hasProfile = false;
  useWizard = false;
  saving = false;
  form: FormGroup = this.fb.group({});
  history: RoleParticipationHistory = { peladas: [], matches: [], teams: [] };
  historyMode = 'none';

  wizardStepIds: RoleProfileWizardStepId[] = [];
  currentStepIndex = 0;

  displayName = '';
  apelido = '';
  avatarUrl: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly roleProfileService: RoleProfileService,
    private readonly roleProfileHistoryService: RoleProfileHistoryService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get showsPeladaHistory(): boolean {
    return this.historyMode === 'pelada_match' || this.historyMode === 'pelada_teams';
  }

  get peladaHistoryPreview() {
    return this.history.peladas.slice(0, 3);
  }

  get matchHistoryPreview() {
    return this.history.matches.slice(0, 3);
  }

  get teamHistoryPreview() {
    return this.history.teams.slice(0, 3);
  }

  get showsMatchHistory(): boolean {
    return this.historyMode === 'pelada_match';
  }

  get showsTeamHistory(): boolean {
    return this.historyMode === 'teams_only' || this.historyMode === 'pelada_teams';
  }

  get wizardStep(): RoleProfileWizardStepId {
    return this.wizardStepIds[this.currentStepIndex] ?? 'intro';
  }

  get wizardProgress(): number {
    if (!this.wizardStepIds.length) return 0;
    return (this.currentStepIndex + 1) / this.wizardStepIds.length;
  }

  get wizardProgressLabel(): string {
    return this.i18n.wizardProgress(
      'roleProfileForm.wizard.progress',
      this.currentStepIndex + 1,
      this.wizardStepIds.length
    );
  }

  get wizardStepHelpKey(): string {
    return `roleProfileForm.wizard.step.${this.wizardStep}.help`;
  }

  get wizardStepTitle(): string {
    const key = `roleProfileForm.wizard.step.${this.wizardStep}.title`;
    const titled = this.i18n.t(key, { role: this.roleLabel });
    return titled !== key ? titled : this.i18n.t(key);
  }

  get wizardStepLead(): string {
    return this.i18n.t(`roleProfileForm.wizard.step.${this.wizardStep}.lead`);
  }

  async ionViewWillEnter(): Promise<void> {
    const roleParam = this.route.snapshot.queryParamMap.get('role');
    const role =
      roleParam && isProfessionalRole(roleParam as ProfileRole)
        ? (roleParam as ProfessionalRole)
        : null;

    if (!role) {
      await this.router.navigateByUrl('/tabs/profile', { replaceUrl: true });
      return;
    }

    this.role = role;
    this.roleLabel = PROFILE_ROLE_LABELS[role as ProfileRole];
    this.historyMode = ROLE_HISTORY_MODE[role];
    this.form = buildRoleProfileForm(this.fb, role);
    this.wizardStepIds = roleProfileWizardSteps(role, this.historyMode !== 'none');

    this.displayName = this.auth.getDisplayName();
    this.apelido = this.auth.getApelido();
    this.avatarUrl = this.auth.getAvatarUrl();

    const profile = await this.roleProfileService.getForRole(role);
    if (profile) {
      this.hasProfile = true;
      this.useWizard = false;
      patchRoleProfileForm(this.form, profile);
    } else {
      this.hasProfile = false;
      this.useWizard = true;
      this.restoreDraft(role);
    }

    if (this.historyMode !== 'none') {
      this.history = await this.roleProfileHistoryService.getHistoryForCurrentUser(role);
    }

    this.cdr.markForCheck();
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
        {
          text: 'Sair',
          role: 'destructive',
          handler: () => {
            void this.router.navigateByUrl('/tabs/profile');
          },
        },
      ],
    });
    await alert.present();
  }

  goWizardNext(): void {
    if (!this.validateWizardStep()) {
      void this.showStepValidationError();
      this.cdr.markForCheck();
      return;
    }
    if (this.currentStepIndex < this.wizardStepIds.length - 1) {
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
    if (!this.role) return false;
    const step = this.wizardStep;
    if (step === 'intro' || step === 'history') {
      return true;
    }
    if (step === 'rates') {
      let ok = true;
      for (const field of ROLE_PROFILE_FIELDS[this.role].filter((f) => f.type === 'money')) {
        const control = this.form.get(field.key);
        control?.markAsTouched();
        if (control?.invalid) ok = false;
      }
      return ok;
    }
    if (step === 'gear') {
      if (
        this.role === 'referee' &&
        this.form.get('isFederatedReferee')?.value &&
        !this.form.get('federationName')?.value?.trim()
      ) {
        this.form.get('federationName')?.markAsTouched();
        return false;
      }
      return true;
    }
    if (step === 'pix') {
      return true;
    }
    return true;
  }

  async submit(): Promise<void> {
    if (!this.role || this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.form, roleProfileFieldLabels(this.role));
      if (message) await this.showError(message);
      return;
    }

    if (
      this.role === 'referee' &&
      this.form.get('isFederatedReferee')?.value &&
      !this.form.get('federationName')?.value?.trim()
    ) {
      await this.showError('Informe a federacao do arbitro.');
      return;
    }

    this.saving = true;
    const loading = await this.loadingCtrl.create({
      message: this.hasProfile ? 'Salvando alteracoes...' : 'Salvando...',
    });
    await loading.present();

    try {
      const payload = payloadFromRoleProfileForm(this.role, this.form.getRawValue());

      if (this.hasProfile) {
        await this.roleProfileService.update(this.role, payload);
      } else {
        await this.roleProfileService.create(payload);
        this.hasProfile = true;
        clearFormDraft(ROLE_PROFILE_FORM_DRAFT_KEY);
      }

      await this.router.navigateByUrl('/tabs/profile', { replaceUrl: true });
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.saving = false;
      await loading.dismiss();
    }
  }

  private restoreDraft(role: ProfessionalRole): void {
    const draft = readFormDraft<RoleProfileFormDraft>(ROLE_PROFILE_FORM_DRAFT_KEY);
    if (!draft || draft.role !== role) return;
    this.currentStepIndex = Math.min(
      Math.max(0, draft.stepIndex ?? 0),
      Math.max(0, this.wizardStepIds.length - 1)
    );
    if (draft.values && typeof draft.values === 'object') {
      this.form.patchValue(draft.values);
    }
  }

  persistDraft(): void {
    if (!this.useWizard || !this.role || this.hasProfile) return;
    writeFormDraft<RoleProfileFormDraft>(ROLE_PROFILE_FORM_DRAFT_KEY, {
      role: this.role,
      stepIndex: this.currentStepIndex,
      values: this.form.getRawValue(),
    });
  }

  private async showStepValidationError(): Promise<void> {
    if (!this.role) return;
    const step = this.wizardStep;
    if (step === 'rates') {
      const labels = roleProfileFieldLabels(this.role);
      const moneyKeys = ROLE_PROFILE_FIELDS[this.role]
        .filter((f) => f.type === 'money')
        .map((f) => f.key);
      const partial: Record<string, string> = {};
      for (const key of moneyKeys) {
        if (labels[key]) partial[key] = labels[key];
      }
      const message =
        buildMissingFieldsMessage(this.form, partial) ||
        'Preencha os valores obrigatórios deste passo.';
      await this.showError(message);
      return;
    }
    if (
      step === 'gear' &&
      this.role === 'referee' &&
      this.form.get('isFederatedReferee')?.value
    ) {
      await this.showError('Informe a federacao do arbitro.');
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

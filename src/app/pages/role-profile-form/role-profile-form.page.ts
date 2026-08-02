import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  ProfessionalRole,
  ROLE_HISTORY_MODE,
  buildRoleProfileForm,
  isProfessionalRole,
  patchRoleProfileForm,
  payloadFromRoleProfileForm,
  roleProfileFieldLabels,
} from '../../core/models/role-profile.model';
import { RoleParticipationHistory } from '../../core/models/role-participation-history.model';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../../core/models/profile-role.model';
import { AuthService } from '../../core/services/auth.service';
import { RoleProfileHistoryService } from '../../core/services/role-profile-history.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

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
  saving = false;
  form: FormGroup = this.fb.group({});
  history: RoleParticipationHistory = { peladas: [], matches: [], teams: [] };
  historyMode = 'none';

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
    private readonly alertCtrl: AlertController
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
    return (
      this.historyMode === 'teams_only' ||
      this.historyMode === 'pelada_teams'
    );
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

    this.displayName = this.auth.getDisplayName();
    this.apelido = this.auth.getApelido();
    this.avatarUrl = this.auth.getAvatarUrl();

    const profile = await this.roleProfileService.getForRole(role);
    if (profile) {
      this.hasProfile = true;
      patchRoleProfileForm(this.form, profile);
    }

    if (this.historyMode !== 'none') {
      this.history = await this.roleProfileHistoryService.getHistoryForCurrentUser(role);
    }
  }

  cancel(): void {
    void this.router.navigateByUrl('/tabs/profile');
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
      }

      await this.router.navigateByUrl('/tabs/profile', { replaceUrl: true });
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.saving = false;
      await loading.dismiss();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

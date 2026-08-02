import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { partsToHeightCm } from '../../core/models/athlete-profile.model';
import {
  EVENT_REGISTRATION_ROLES,
  PROFILE_ROLE_LABELS,
  ProfileRole,
} from '../../core/models/profile-role.model';
import {
  ProfessionalRole,
  buildRoleProfileForm,
  isProfessionalRole,
  payloadFromRoleProfileForm,
  roleProfileFieldLabels,
} from '../../core/models/role-profile.model';
import { WizardPath } from '../../core/models/wizard.model';
import { AppStorageService } from '../../core/services/app-storage.service';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { FanProfileService } from '../../core/services/fan-profile.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';

type OtherSetupStep = 'pick' | 'form' | 'fan';

@Component({
  selector: 'app-profile-setup',
  templateUrl: './profile-setup.page.html',
  styleUrls: ['./profile-setup.page.scss'],
  standalone: false,
})
export class ProfileSetupPage {
  loading = true;
  wizardPath: WizardPath | null = null;
  selectedRole: ProfileRole | null = null;
  otherStep: OtherSetupStep = 'pick';
  otherForm: FormGroup = this.fb.group({});

  otherRoles = EVENT_REGISTRATION_ROLES
    .filter((role) => role !== 'athlete')
    .map((value) => ({ value, label: PROFILE_ROLE_LABELS[value] }));

  athleteForm = this.fb.group({
    primaryPosition: ['', Validators.required],
    secondaryPosition: [''],
    thirdPosition: [''],
    shoeSize: [null as number | null, Validators.required],
    heightMeter: [null as number | null, Validators.required],
    heightCm: [null as number | null, Validators.required],
    weight: [null as number | null, Validators.required],
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

  constructor(
    private readonly fb: FormBuilder,
    private readonly storage: AppStorageService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly fanProfileService: FanProfileService,
    private readonly roleProfileService: RoleProfileService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.wizardPath = await this.storage.getWizardPath();
    if (!this.wizardPath) {
      await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
      return;
    }
    this.loading = false;
  }

  get selectedRoleLabel(): string {
    return this.selectedRole ? PROFILE_ROLE_LABELS[this.selectedRole] : '';
  }

  get isProfessionalSelected(): boolean {
    return !!this.selectedRole && isProfessionalRole(this.selectedRole);
  }

  get professionalRole(): ProfessionalRole | null {
    return this.selectedRole && isProfessionalRole(this.selectedRole) ? this.selectedRole : null;
  }

  selectRole(role: ProfileRole): void {
    this.selectedRole = role;
    this.otherStep = 'pick';
    this.otherForm = this.fb.group({});
  }

  continueOtherProfile(): void {
    if (!this.selectedRole) return;

    if (this.selectedRole === 'fan') {
      this.otherStep = 'fan';
      return;
    }

    if (isProfessionalRole(this.selectedRole)) {
      this.otherForm = buildRoleProfileForm(this.fb, this.selectedRole);
      this.otherStep = 'form';
    }
  }

  backToRolePick(): void {
    this.otherStep = 'pick';
  }

  async saveAthleteProfile(): Promise<void> {
    if (this.athleteForm.invalid) {
      this.athleteForm.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.athleteForm, {
        primaryPosition: 'Posicao principal',
        shoeSize: 'Numero do pe',
        heightMeter: 'Altura (metros)',
        heightCm: 'Altura (centimetros)',
        weight: 'Peso',
      });
      if (message) await this.showError(message);
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Salvando perfil...' });
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
        peladaRate: v.peladaRate != null ? Number(v.peladaRate) : undefined,
        teamMatchRate: v.teamMatchRate != null ? Number(v.teamMatchRate) : undefined,
      });
      await this.auth.setPrimaryRole('athlete');
      await this.finishSetup();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
    } finally {
      await loading.dismiss();
    }
  }

  async saveOtherProfile(): Promise<void> {
    if (!this.selectedRole) {
      await this.showError('Selecione o perfil que representa voce no futebol.');
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

    const loading = await this.loadingCtrl.create({ message: 'Salvando...' });
    await loading.present();

    try {
      await this.roleProfileService.create(
        payloadFromRoleProfileForm(this.selectedRole, this.otherForm.getRawValue())
      );
      await this.auth.setPrimaryRole(this.selectedRole);
      await this.finishSetup();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
    } finally {
      await loading.dismiss();
    }
  }

  private async saveFanProfile(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Salvando...' });
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
      await this.showError(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
    } finally {
      await loading.dismiss();
    }
  }

  async skip(): Promise<void> {
    await this.finishSetup();
  }

  private async finishSetup(): Promise<void> {
    await this.storage.setProfileWizardComplete();
    await this.storage.clearWizardPath();
    await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

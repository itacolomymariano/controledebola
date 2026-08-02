import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppStorageService } from '../../core/services/app-storage.service';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../../core/models/profile-role.model';
import { PROFESSIONAL_ROLES, ProfessionalRole } from '../../core/models/role-profile.model';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { TeamService } from '../../core/services/team.service';
import { FanProfileService } from '../../core/services/fan-profile.service';
import { RefereeInvitationService } from '../../core/services/referee-invitation.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit, OnDestroy {
  userName = '';
  userEmail = '';
  avatarUrl: string | null = null;
  biometricEnabled = false;
  hasAthleteProfile = false;
  hasTeam = false;
  hasFanProfile = false;
  primaryRole: ProfileRole | null = null;
  primaryRoleLabel = '';
  pendingInvitations = 0;

  readonly professionalRoles = PROFESSIONAL_ROLES;
  roleProfileRegistered: Record<ProfessionalRole, boolean> = {
    referee: false,
    scout: false,
    journalist: false,
    cameraman: false,
    narrator: false,
    coach: false,
    physical_trainer: false,
    masseur: false,
    kitman: false,
    gandula: false,
    gatekeeper: false,
  };

  private profileSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly roleProfileService: RoleProfileService,
    private readonly teamService: TeamService,
    private readonly fanProfileService: FanProfileService,
    private readonly refereeInvitationService: RefereeInvitationService,
    private readonly storage: AppStorageService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  ngOnInit(): void {
    this.profileSub = this.auth.onProfileChanged.subscribe(() => {
      void this.loadProfile();
    });
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadProfile();
  }

  roleLabel(role: ProfessionalRole): string {
    return PROFILE_ROLE_LABELS[role];
  }

  openAthleteProfile(): void {
    void this.router.navigateByUrl('/athlete-profile/form');
  }

  openAthleteHiring(): void {
    void this.router.navigateByUrl('/athlete-profile/hiring');
  }

  openTeamForm(): void {
    void this.router.navigateByUrl('/team/form');
  }

  openRoleProfile(role: ProfessionalRole): void {
    void this.router.navigate(['/role-profile/form'], { queryParams: { role } });
  }

  openKitmanMaterial(): void {
    void this.router.navigate(['/material-inventory'], {
      queryParams: { ownerType: 'kitman' },
    });
  }

  openFanProfile(): void {
    void this.router.navigateByUrl('/fan-profile/form');
  }

  openAccountEdit(): void {
    void this.router.navigateByUrl('/account/edit');
  }

  openLegends(): void {
    void this.router.navigateByUrl('/legends');
  }

  openInbox(): void {
    void this.router.navigateByUrl('/inbox');
  }

  async onAvatarSelected(file: File): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Salvando foto...' });
    await loading.present();

    try {
      await this.auth.updateAvatar(file);
      this.avatarUrl = this.auth.getAvatarUrl();
    } catch (error: unknown) {
      const alert = await this.alertCtrl.create({
        header: 'Erro',
        message: parseErrorMessage(error),
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      await loading.dismiss();
    }
  }

  async toggleBiometric(event: CustomEvent): Promise<void> {
    await this.storage.setBiometricEnabled(!!event.detail.checked);
    this.biometricEnabled = !!event.detail.checked;
  }

  async logout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sair do App',
      message: 'Deseja realmente sair?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sair',
          role: 'destructive',
          handler: () => {
            void this.doLogout();
          },
        },
      ],
    });
    await alert.present();
  }

  private async loadProfile(): Promise<void> {
    if (this.auth.isLoggedIn()) {
      await this.auth.fetchCurrentUser();
    }

    this.userName = this.auth.getDisplayName();
    const user = this.auth.getCurrentUser();
    this.userEmail = (user?.get('email') as string) || user?.getUsername() || '';
    this.avatarUrl = this.auth.getAvatarUrl();
    this.biometricEnabled = await this.storage.isBiometricEnabled();
    this.primaryRole = this.auth.getPrimaryRole();
    this.primaryRoleLabel = this.primaryRole ? PROFILE_ROLE_LABELS[this.primaryRole] : '';
    this.hasAthleteProfile = !!(await this.athleteProfileService.getForCurrentUser());
    this.hasTeam = !!(await this.teamService.getForCurrentUser());
    this.hasFanProfile = !!(await this.fanProfileService.getForCurrentUser());
    this.pendingInvitations = await this.refereeInvitationService.countPendingForCurrentUser();

    for (const role of PROFESSIONAL_ROLES) {
      this.roleProfileRegistered[role] = !!(await this.roleProfileService.getForRole(role));
    }
  }

  private async doLogout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppInviteShareService } from '../../core/services/app-invite-share.service';
import { AppStorageService } from '../../core/services/app-storage.service';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../../core/models/profile-role.model';
import { PROFESSIONAL_ROLES, ProfessionalRole } from '../../core/models/role-profile.model';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { TeamService } from '../../core/services/team.service';
import { FanProfileService } from '../../core/services/fan-profile.service';
import { RefereeInvitationService } from '../../core/services/referee-invitation.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { I18nService } from '../../core/services/i18n.service';
import { ThemePaletteService } from '../../core/services/theme-palette.service';
import { AppGuideService } from '../../core/services/app-guide.service';
import { APP_LOCALE_LABELS, APP_LOCALES, AppLocale } from '../../core/models/app-locale.model';
import { THEME_PALETTE_IDS, ThemePaletteId } from '../../core/models/theme-palette.model';

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
  inviteShareBusy = false;
  readonly locales = APP_LOCALES;
  readonly localeLabels = APP_LOCALE_LABELS;
  currentLocale: AppLocale = 'pt-BR';
  readonly paletteIds = THEME_PALETTE_IDS;
  currentPalette: ThemePaletteId = 'default';

  get paletteLabelKeys() {
    return this.theme.labelKeys;
  }

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
    private readonly appInviteShare: AppInviteShareService,
    private readonly storage: AppStorageService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly i18n: I18nService,
    private readonly theme: ThemePaletteService,
    private readonly appGuide: AppGuideService
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
    this.currentLocale = this.i18n.locale;
    this.currentPalette = this.theme.current;
    await this.loadProfile();
  }

  async onLocaleChange(event: CustomEvent): Promise<void> {
    const locale = (event.detail as { value?: AppLocale })?.value;
    if (!locale || locale === this.currentLocale) return;
    await this.i18n.setLocale(locale);
    this.currentLocale = locale;
  }

  async onPaletteChange(event: CustomEvent): Promise<void> {
    const palette = (event.detail as { value?: ThemePaletteId })?.value;
    if (!palette || palette === this.currentPalette) return;
    await this.theme.setPalette(palette);
    this.currentPalette = palette;
  }

  openGuide(): void {
    this.appGuide.openManual();
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

  async inviteFriends(): Promise<void> {
    if (this.inviteShareBusy) return;
    this.inviteShareBusy = true;
    try {
      await this.appInviteShare.shareInvite();
    } finally {
      this.inviteShareBusy = false;
    }
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

  async requestAccountDeletion(): Promise<void> {
    const intro = await this.alertCtrl.create({
      header: 'Excluir conta',
      message:
        'Esta acao e permanente. Seus dados pessoais serao apagados e voce nao podera mais entrar com esta conta. Peladas e eventos que voce organizou permanecem para os outros participantes.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Continuar',
          role: 'destructive',
          handler: () => {
            void this.confirmAccountDeletion();
          },
        },
      ],
    });
    await intro.present();
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

  private async confirmAccountDeletion(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirme com a senha',
      message: 'Digite sua senha para excluir a conta definitivamente.',
      inputs: [{ name: 'password', type: 'password', placeholder: 'Senha da conta' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir definitivamente',
          role: 'destructive',
          handler: (data) => {
            void this.doDeleteAccount(String(data?.password || ''));
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async doDeleteAccount(password: string): Promise<void> {
    if (!password.trim()) {
      const alert = await this.alertCtrl.create({
        header: 'Erro',
        message: 'Informe sua senha para confirmar a exclusao.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Excluindo conta...' });
    await loading.present();
    try {
      await this.auth.deleteAccount(password);
      const done = await this.alertCtrl.create({
        header: 'Conta excluida',
        message: 'Sua conta foi excluida. Voce ja pode fechar o app ou criar uma nova conta.',
        buttons: ['OK'],
      });
      await done.present();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
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

  private async doLogout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AppStorageService } from './app-storage.service';
import { AthleteProfileService } from './athlete-profile.service';
import { AuthService } from './auth.service';
import { RoleProfileService } from './role-profile.service';

@Injectable({ providedIn: 'root' })
export class PostAuthNavigationService {
  constructor(
    private readonly router: Router,
    private readonly storage: AppStorageService,
    private readonly auth: AuthService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly roleProfileService: RoleProfileService
  ) {}

  async syncProfileWizardForCurrentUser(): Promise<void> {
    if (!this.auth.isLoggedIn()) return;
    if (await this.storage.isProfileWizardComplete()) return;

    const user = this.auth.getCurrentUser();
    const primaryRole = user?.get('primaryRole') as string | undefined;
    if (primaryRole) {
      await this.storage.setProfileWizardComplete();
      return;
    }

    const [athleteProfile, roleProfile] = await Promise.all([
      this.athleteProfileService.getForCurrentUser(),
      this.roleProfileService.getForCurrentUser(),
    ]);

    if (athleteProfile || roleProfile) {
      await this.storage.setProfileWizardComplete();
    }
  }

  async navigateAfterAuth(): Promise<void> {
    await this.syncProfileWizardForCurrentUser();

    if (await this.storage.isProfileWizardComplete()) {
      await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
      return;
    }

    if (await this.shouldNavigateToProfileSetup()) {
      if (!(await this.storage.getWizardPath())) {
        await this.storage.setWizardPath('athlete');
      }
      await this.router.navigateByUrl('/profile-setup', { replaceUrl: true });
      return;
    }

    await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
  }

  /** Conta nova sem onboarding (Login → Criar conta) ainda deve ir ao profile-setup wizard. */
  private async shouldNavigateToProfileSetup(): Promise<boolean> {
    if (await this.storage.isProfileWizardComplete()) return false;
    if (await this.storage.getWizardPath()) return true;

    if (!this.auth.isLoggedIn()) return false;
    const user = this.auth.getCurrentUser();
    if (user?.get('primaryRole')) return false;

    const [athleteProfile, roleProfile] = await Promise.all([
      this.athleteProfileService.getForCurrentUser(),
      this.roleProfileService.getForCurrentUser(),
    ]);
    return !athleteProfile && !roleProfile;
  }
}

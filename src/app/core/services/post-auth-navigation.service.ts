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
    if (await this.storage.isProfileWizardComplete()) {
      void this.syncProfileWizardForCurrentUser();
      await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
      return;
    }

    const wizardPath = await this.storage.getWizardPath();
    if (!wizardPath) {
      void this.syncProfileWizardForCurrentUser();
      await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
      return;
    }

    await this.syncProfileWizardForCurrentUser();

    if (await this.storage.needsProfileSetup()) {
      await this.router.navigateByUrl('/profile-setup', { replaceUrl: true });
      return;
    }

    await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
  }
}

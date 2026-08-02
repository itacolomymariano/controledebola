import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppStorageService } from '../../core/services/app-storage.service';
import { PostAuthNavigationService } from '../../core/services/post-auth-navigation.service';

const MIN_SPLASH_MS = 400;

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: false,
})
export class SplashPage implements OnInit {
  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly storage: AppStorageService,
    private readonly postAuthNav: PostAuthNavigationService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.storage.init();

    const minSplash = new Promise<void>((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
    const sessionCheck = this.auth.isLoggedIn()
      ? this.auth.validateSession()
      : Promise.resolve(false);

    try {
      const sessionValid = await sessionCheck;

      if (sessionValid) {
        if (await this.storage.isProfileWizardComplete()) {
          await minSplash;
          await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
          void this.postAuthNav.syncProfileWizardForCurrentUser();
          return;
        }

        const wizardPath = await this.storage.getWizardPath();
        if (!wizardPath) {
          await minSplash;
          void this.postAuthNav.syncProfileWizardForCurrentUser();
          await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
          return;
        }

        await this.postAuthNav.syncProfileWizardForCurrentUser();
        await minSplash;

        if (await this.storage.needsProfileSetup()) {
          await this.router.navigateByUrl('/profile-setup', { replaceUrl: true });
          return;
        }

        await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
        return;
      }
    } catch {
      // validateSession so relanca erros inesperados; segue para login/onboarding.
    }

    await minSplash;
    const onboardingDone = await this.storage.isOnboardingComplete();
    await this.router.navigateByUrl(onboardingDone ? '/login' : '/onboarding', {
      replaceUrl: true,
    });
  }
}

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ParticipationChoice } from '../../core/models/wizard.model';
import { AppStorageService } from '../../core/services/app-storage.service';

type OnboardingStep = 'welcome' | 'about' | 'participation';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage {
  step: OnboardingStep = 'welcome';

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly storage: AppStorageService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    const stepParam = this.route.snapshot.queryParamMap.get('step');
    if (stepParam === 'participation' || stepParam === 'about' || stepParam === 'welcome') {
      this.step = stepParam;
      return;
    }

    const wizardPath = await this.storage.getWizardPath();
    if (wizardPath) {
      this.step = 'participation';
    }
  }

  goToAbout(): void {
    this.step = 'about';
  }

  goToParticipation(): void {
    this.step = 'participation';
  }

  back(): void {
    if (this.step === 'participation') {
      this.step = 'about';
      return;
    }
    if (this.step === 'about') {
      this.step = 'welcome';
    }
  }

  async chooseParticipation(choice: ParticipationChoice): Promise<void> {
    const path = choice === 'other' ? 'other' : 'athlete';
    await this.storage.setWizardPath(path);
    await this.router.navigateByUrl('/register');
  }

  async skipToRegister(): Promise<void> {
    await this.storage.setOnboardingComplete();
    await this.storage.clearWizardPath();
    await this.router.navigateByUrl('/register', { replaceUrl: true });
  }
}

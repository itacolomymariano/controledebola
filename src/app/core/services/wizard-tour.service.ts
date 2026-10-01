import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import Parse from 'parse';
import {
  WIZARD_TOUR_AUTH_ROUTES,
  WIZARD_TOUR_STEPS,
  WizardTourStep,
} from '../models/wizard-tour.model';
import { AppStorageService } from './app-storage.service';
import { AuthService } from './auth.service';
import { TeamService } from './team.service';

@Injectable({ providedIn: 'root' })
export class WizardTourService {
  readonly active$ = new BehaviorSubject(false);
  readonly stepIndex$ = new BehaviorSubject(0);
  /** When set, overlay stays hidden until the pending step is completed (e.g. athlete save). */
  readonly pendingCompletionStepId$ = new BehaviorSubject<string | null>(null);

  private autoTried = false;
  private lastUserId: string | null = null;

  constructor(
    private readonly storage: AppStorageService,
    private readonly auth: AuthService,
    private readonly teamService: TeamService
  ) {}

  get active(): boolean {
    return this.active$.value;
  }

  get stepIndex(): number {
    return this.stepIndex$.value;
  }

  get pendingCompletionStepId(): string | null {
    return this.pendingCompletionStepId$.value;
  }

  get steps(): WizardTourStep[] {
    return WIZARD_TOUR_STEPS;
  }

  get current(): WizardTourStep | null {
    if (!this.active) return null;
    return WIZARD_TOUR_STEPS[this.stepIndex] ?? null;
  }

  get total(): number {
    return WIZARD_TOUR_STEPS.length;
  }

  isAuthRoute(url: string): boolean {
    const path = url.split('?')[0];
    return WIZARD_TOUR_AUTH_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
  }

  isPausedOnRoute(url: string): boolean {
    const pending = this.pendingCompletionStepId;
    if (!pending) return false;
    const step = WIZARD_TOUR_STEPS.find((row) => row.id === pending);
    if (!step?.route) return false;
    const path = url.split('?')[0];
    return path === step.route || path.startsWith(`${step.route}/`);
  }

  startFromMenu(): void {
    void this.startAtFirstRelevantStep();
  }

  skip(): void {
    this.clearPendingCompletion();
    this.advance();
  }

  async close(): Promise<void> {
    this.clearPendingCompletion();
    this.active$.next(false);
    const userId = this.auth.getCurrentUser()?.id;
    if (userId) {
      await this.storage.setWizardTourDismissed(userId);
    }
  }

  /**
   * CTA "Seguir": for athlete step, navigate without advancing until profile is saved.
   * Other steps advance immediately as before.
   */
  followRoute(): string | null {
    const step = this.current;
    if (!step) return null;

    if (step.id === 'athlete') {
      this.pendingCompletionStepId$.next('athlete');
      return step.route;
    }

    this.advance();
    return step.route;
  }

  /** Called after athlete profile create/update succeeds. */
  completePendingStep(): void {
    const pending = this.pendingCompletionStepId;
    if (!pending) return;
    this.clearPendingCompletion();
    if (!this.active) {
      this.active$.next(true);
    }
    const current = this.current;
    if (current?.id === pending) {
      this.advance();
    }
  }

  async maybeAutoStart(url: string): Promise<void> {
    this.syncUserSession();
    if (this.active || this.autoTried) return;
    if (!this.auth.isLoggedIn() || this.isAuthRoute(url)) return;

    const userId = this.auth.getCurrentUser()?.id;
    if (!userId) return;

    this.autoTried = true;
    if (await this.storage.isWizardTourDismissed(userId)) return;

    const hasActivity = await this.hasActivityBeyondProfile();
    await this.storage.setWizardTourOffered(userId);
    if (hasActivity) return;

    await this.startAtFirstRelevantStep();
  }

  resetSession(): void {
    this.autoTried = false;
    this.clearPendingCompletion();
    this.active$.next(false);
    this.stepIndex$.next(0);
  }

  private async startAtFirstRelevantStep(): Promise<void> {
    const hasAthlete = await this.hasAthleteProfile();
    const startIndex = hasAthlete
      ? Math.max(
          0,
          WIZARD_TOUR_STEPS.findIndex((step) => step.id === 'find-pelada')
        )
      : 0;
    this.clearPendingCompletion();
    this.stepIndex$.next(startIndex >= 0 ? startIndex : 0);
    this.active$.next(true);
  }

  private clearPendingCompletion(): void {
    if (this.pendingCompletionStepId$.value != null) {
      this.pendingCompletionStepId$.next(null);
    }
  }

  private syncUserSession(): void {
    const userId = this.auth.getCurrentUser()?.id ?? null;
    if (this.lastUserId === userId) return;
    this.resetSession();
    this.lastUserId = userId;
  }

  private advance(): void {
    const next = this.stepIndex + 1;
    if (next >= WIZARD_TOUR_STEPS.length) {
      void this.close();
      return;
    }
    this.stepIndex$.next(next);
  }

  private async hasAthleteProfile(): Promise<boolean> {
    const user = Parse.User.current();
    if (!user) return false;
    return this.firstOf('AthleteProfile', 'user', user);
  }

  private async hasActivityBeyondProfile(): Promise<boolean> {
    const user = Parse.User.current();
    if (!user) return false;

    const checks = await Promise.allSettled([
      this.firstOf('Pelada', 'admin', user),
      this.firstOf('PeladaMembership', 'user', user),
      this.firstOf('EventRegistration', 'user', user),
      this.teamService.listMine().then((teams) => teams.length > 0),
    ]);
    return checks.some((result) => result.status === 'fulfilled' && result.value);
  }

  private async firstOf(className: string, field: string, user: Parse.User): Promise<boolean> {
    const query = new Parse.Query(className);
    query.equalTo(field, user);
    query.limit(1);
    const row = await query.first();
    return !!row;
  }
}

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import Parse from 'parse';
import {
  WIZARD_TOUR_AUTH_ROUTES,
  WIZARD_TOUR_LEGACY_STEPS,
  WizardTourChoice,
  WizardTourStep,
  buildOtherWizardFlow,
  buildPeladaWizardFlow,
  buildTeamWizardFlow,
  peladaBranchTail,
  roleHintStepForPrimaryRole,
  teamBranchTail,
} from '../models/wizard-tour.model';
import { AppInviteShareService } from './app-invite-share.service';
import { AppStorageService } from './app-storage.service';
import { AuthService } from './auth.service';
import { TeamService } from './team.service';

@Injectable({ providedIn: 'root' })
export class WizardTourService {
  readonly active$ = new BehaviorSubject(false);
  readonly stepIndex$ = new BehaviorSubject(0);
  readonly flowRevision$ = new BehaviorSubject(0);
  /** When set, overlay stays hidden until the pending step is completed (e.g. athlete save). */
  readonly pendingCompletionStepId$ = new BehaviorSubject<string | null>(null);

  private autoTried = false;
  private lastUserId: string | null = null;
  private flowSteps: WizardTourStep[] = [];

  constructor(
    private readonly storage: AppStorageService,
    private readonly auth: AuthService,
    private readonly teamService: TeamService,
    private readonly inviteShare: AppInviteShareService,
    private readonly router: Router
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
    return this.flowSteps;
  }

  get current(): WizardTourStep | null {
    if (!this.active) return null;
    return this.flowSteps[this.stepIndex] ?? null;
  }

  get total(): number {
    return this.flowSteps.length;
  }

  isAuthRoute(url: string): boolean {
    const path = url.split('?')[0];
    return WIZARD_TOUR_AUTH_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
  }

  isPausedOnRoute(url: string): boolean {
    const pending = this.pendingCompletionStepId;
    if (!pending) return false;
    const path = url.split('?')[0];
    const step = this.flowSteps.find((row) => row.id === pending);
    if (step?.route) {
      const stepPath = step.route.split('?')[0];
      if (path === stepPath || path.startsWith(`${stepPath}/`)) return true;
    }
    if (pending === 'team-player-search' && /^\/team\/[^/]+$/.test(path)) return true;
    if (pending === 'pelada-player-search' && /^\/pelada\/[^/]+$/.test(path)) return true;
    return false;
  }

  /** Passos em que fechar o tour exige confirmacao (participacao ainda pendente). */
  pendingJoinSearchStepId(): string | null {
    const pending = this.pendingCompletionStepId;
    if (pending === 'team-player-search' || pending === 'pelada-player-search') {
      return pending;
    }
    return null;
  }

  startFromMenu(): void {
    void this.startAtFirstRelevantStep(true);
  }

  skip(): void {
    this.clearPendingCompletion();
    this.advance();
  }

  async close(): Promise<void> {
    this.clearPendingCompletion();
    this.active$.next(false);
    await this.markDismissedForCurrentUser();
    await this.router.navigateByUrl('/tabs/peladas');
  }

  /** First-access search: user opened a pelada/time — end tour without leaving the current page. */
  async dismissJoinSearchStayOnPage(): Promise<void> {
    this.clearPendingCompletion();
    this.active$.next(false);
    await this.markDismissedForCurrentUser();
  }

  back(): void {
    if (this.stepIndex <= 0) return;
    this.clearPendingCompletion();
    this.stepIndex$.next(this.stepIndex - 1);
  }

  /**
   * CTA "Seguir": pause on steps that require completion; choice steps use selectChoice instead.
   */
  followRoute(): string | null {
    const step = this.current;
    if (!step || step.kind !== 'route' || !step.route) return null;

    if (step.pauseUntilComplete) {
      this.pendingCompletionStepId$.next(step.id);
      return step.route;
    }

    this.advance();
    return step.route;
  }

  /** Secondary CTA: advance without navigating (e.g. skip search step). */
  continueWithoutRoute(): void {
    this.clearPendingCompletion();
    this.advance();
  }

  selectChoice(choice: WizardTourChoice): void {
    const step = this.current;
    if (!step || step.kind !== 'choices') return;

    if (choice.action === 'share_invite') {
      void this.inviteShare.shareInvite();
      return;
    }
    if (choice.action === 'finish') {
      void this.close();
      return;
    }

    if (step.id === 'pelada-role') {
      this.appendBranchTail(peladaBranchTail(choice.id));
    } else if (step.id === 'team-role') {
      this.appendBranchTail(teamBranchTail(choice.id));
    }

    this.advance();
    if (choice.route) {
      void this.router.navigateByUrl(choice.route);
    }
  }

  /** Called after athlete profile create/update succeeds. */
  completePendingStep(): void {
    const pending = this.pendingCompletionStepId;
    if (!pending) return;
    this.completeStepById(pending);
  }

  completeStepById(stepId: string): void {
    const pending = this.pendingCompletionStepId;
    const current = this.current;
    const relevant = pending === stepId || (this.active && current?.id === stepId);
    if (!relevant) return;
    if (pending === stepId) {
      this.clearPendingCompletion();
    }
    if (!this.active) {
      this.active$.next(true);
    }
    if (current?.id === stepId) {
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

    await this.startAtFirstRelevantStep(false);
  }

  resetSession(): void {
    this.autoTried = false;
    this.clearPendingCompletion();
    this.active$.next(false);
    this.stepIndex$.next(0);
    this.flowSteps = [];
    this.bumpFlowRevision();
  }

  private async startAtFirstRelevantStep(fromMenu: boolean): Promise<void> {
    this.flowSteps = await this.buildFlow(fromMenu);
    this.clearPendingCompletion();
    this.stepIndex$.next(0);
    this.active$.next(true);
    this.bumpFlowRevision();
  }

  private async buildFlow(fromMenu: boolean): Promise<WizardTourStep[]> {
    const choice = await this.storage.getParticipationChoice();
    const hasAthlete = await this.hasAthleteProfile();

    if (fromMenu && !choice) {
      return [...WIZARD_TOUR_LEGACY_STEPS];
    }

    if (choice === 'amateur_team') {
      return buildTeamWizardFlow(!hasAthlete);
    }
    if (choice === 'other') {
      return buildOtherWizardFlow(roleHintStepForPrimaryRole(this.auth.getPrimaryRole()));
    }
    return buildPeladaWizardFlow(!hasAthlete);
  }

  private appendBranchTail(tail: WizardTourStep[]): void {
    const head = this.flowSteps.slice(0, this.stepIndex + 1);
    this.flowSteps = [...head, ...tail];
    this.bumpFlowRevision();
  }

  private bumpFlowRevision(): void {
    this.flowRevision$.next(this.flowRevision$.value + 1);
  }

  private async markDismissedForCurrentUser(): Promise<void> {
    const userId = this.auth.getCurrentUser()?.id;
    if (userId) {
      await this.storage.setWizardTourDismissed(userId);
    }
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
    if (next >= this.flowSteps.length) {
      void this.close();
      return;
    }
    this.stepIndex$.next(next);
  }

  /** Fim natural do tour: Home + marcar como visto. */
  async finish(): Promise<void> {
    await this.close();
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

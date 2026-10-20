import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { PeladaEvent } from '../../core/models/event.model';
import {
  EventTeamSplitState,
  isBinaryPresetSplitMode,
  presetFromSplitMode,
  TeamSplitAthlete,
  TeamSplitMode,
  TeamSplitRandomStrategy,
} from '../../core/models/team-split.model';
import { EventService } from '../../core/services/event.service';
import { I18nService } from '../../core/services/i18n.service';
import { PeladaService } from '../../core/services/pelada.service';
import { TeamSplitService } from '../../core/services/team-split.service';
import {
  buildPositionGroups,
  createEmptyTeams,
  presetBinarySplit,
  randomTeamSplit,
  teamMediaCbAverage,
  removeAthleteFromTeams,
  resizeTeamsPreservingAssignments,
  teamsOverCapacity,
} from '../../core/utils/team-split.util';

@Component({
  selector: 'app-event-team-split',
  templateUrl: './event-team-split.page.html',
  styleUrls: ['./event-team-split.page.scss'],
  standalone: false,
})
export class EventTeamSplitPage {
  event: PeladaEvent | null = null;
  loading = true;
  readOnly = false;
  saving = false;
  clearing = false;
  savedAt: string | null = null;
  /** JSON snapshot of last saved / loaded state for dirty detection. */
  private savedSnapshot = '';
  athletesPerTeam = 5;
  teamCount = 2;
  splitMode: TeamSplitMode = 'manual';
  randomStrategy: TeamSplitRandomStrategy = 'default';
  ageThreshold = 30;

  pool: TeamSplitAthlete[] = [];
  teams: TeamSplitAthlete[][] = [];
  allAthletes: TeamSplitAthlete[] = [];
  positionGroups: Array<{ position: string; athletes: TeamSplitAthlete[] }> = [];

  /** Atleta selecionado para atribuicao rapida (toque no mobile). */
  assignmentAthlete: TeamSplitAthlete | null = null;
  assignmentFromTeamIndex: number | null = null;

  readonly isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  private draggedAthlete: TeamSplitAthlete | null = null;
  private draggedFromTeamIndex: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly eventService: EventService,
    private readonly peladaService: PeladaService,
    private readonly teamSplitService: TeamSplitService,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
    private readonly i18n: I18nService
  ) {}

  get lockTeamCount(): boolean {
    return isBinaryPresetSplitMode(this.splitMode);
  }

  get canAdjustTeams(): boolean {
    return !this.readOnly;
  }

  get overCapacityTeamIndexes(): number[] {
    return teamsOverCapacity(this.teams, this.athletesPerTeam);
  }

  hasNoAssignedAthletes(): boolean {
    return this.teams.every((team) => team.length === 0);
  }

  get splitDirty(): boolean {
    return this.captureSnapshot() !== this.savedSnapshot;
  }

  get hasSavedSplitOnServer(): boolean {
    return !!this.savedAt;
  }

  formatAthletePoints(points: number): string {
    const value = Number(points) || 0;
    return value.toFixed(1);
  }

  /** Media CB do time (1 casa). Vazio: traco. */
  teamMediaCbLabel(team: TeamSplitAthlete[]): string {
    const average = teamMediaCbAverage(team);
    if (average == null) return '—';
    return average.toFixed(1);
  }

  formatArrivalOrder(athlete: TeamSplitAthlete): string | null {
    if (athlete.arrivalOrder == null || athlete.arrivalOrder <= 0) return null;
    return this.i18n.t('teamSplit.arrivalOrder', { order: athlete.arrivalOrder });
  }

  membershipLabel(athlete: TeamSplitAthlete): string {
    return athlete.isSocio || athlete.membershipType === 'socio'
      ? this.i18n.t('teamSplit.membershipSocio')
      : this.i18n.t('teamSplit.membershipGuest');
  }

  ageLabel(age: number): string {
    return this.i18n.t('teamSplit.ageYears', { age });
  }

  get showTeamAssignmentDock(): boolean {
    return this.canAdjustTeams && !!this.assignmentAthlete;
  }

  get manualAssignmentHint(): string {
    return this.isTouchDevice
      ? this.i18n.t('teamSplit.manualHintTouch')
      : this.i18n.t('teamSplit.manualHintDesktop');
  }

  isAthleteSelected(athlete: TeamSplitAthlete): boolean {
    return this.assignmentAthlete?.userId === athlete.userId;
  }

  canDragAthletes(): boolean {
    return this.canAdjustTeams && !this.isTouchDevice;
  }

  onAthleteCardTap(athlete: TeamSplitAthlete, fromTeamIndex: number | null): void {
    if (!this.canAdjustTeams) return;

    if (this.isAthleteSelected(athlete)) {
      this.cancelAssignment();
      return;
    }

    this.beginAssignment(athlete, fromTeamIndex);
  }

  beginAssignment(athlete: TeamSplitAthlete, fromTeamIndex: number | null): void {
    if (!this.canAdjustTeams) return;
    this.assignmentAthlete = athlete;
    this.assignmentFromTeamIndex = fromTeamIndex;
  }

  cancelAssignment(): void {
    this.assignmentAthlete = null;
    this.assignmentFromTeamIndex = null;
  }

  assignActiveAthleteToTeam(teamIndex: number): void {
    if (!this.assignmentAthlete) return;

    const athlete = this.assignmentAthlete;
    if (this.assignmentFromTeamIndex != null) {
      removeAthleteFromTeams(this.teams, athlete.userId);
    } else {
      this.pool = this.pool.filter((row) => row.userId !== athlete.userId);
    }

    const existingIndex = this.teams[teamIndex].findIndex((row) => row.userId === athlete.userId);
    if (existingIndex < 0) {
      this.teams[teamIndex].push(athlete);
    }

    this.positionGroups = buildPositionGroups(this.pool);
    this.savedAt = null;
    this.warnOverCapacity();
    this.cancelAssignment();
  }

  assignActiveAthleteToPool(): void {
    if (!this.assignmentAthlete) return;

    const athlete = this.assignmentAthlete;
    if (this.assignmentFromTeamIndex != null) {
      removeAthleteFromTeams(this.teams, athlete.userId);
    } else {
      this.pool = this.pool.filter((row) => row.userId !== athlete.userId);
    }

    if (!this.pool.some((row) => row.userId === athlete.userId)) {
      this.pool.push(athlete);
    }

    this.positionGroups = buildPositionGroups(this.pool);
    this.savedAt = null;
    this.cancelAssignment();
  }

  async ionViewWillEnter(): Promise<void> {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) {
      await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
      return;
    }

    this.loading = true;
    try {
      const loadedEvent = await this.eventService.getById(eventId);
      if (!loadedEvent) {
        await this.showError(this.i18n.t('teamSplit.eventNotFound'));
        await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
        return;
      }

      const event = await this.enrichEventPeladaSettings(loadedEvent);
      this.event = event;
      this.readOnly =
        this.isEventFinished(event) && !event.allowTeamSplitAfterEventEnd;
      const [athletes, saved] = await Promise.all([
        this.teamSplitService.listAthletesForEvent(eventId),
        this.teamSplitService.getSavedSplit(eventId),
      ]);
      this.allAthletes = athletes;

      if (saved) {
        this.applySavedState(saved);
      } else if (this.readOnly) {
        await this.showError(this.i18n.t('teamSplit.noSavedSplit'));
        this.goBack();
        return;
      } else {
        this.pool = [...athletes];
        this.positionGroups = buildPositionGroups(athletes);
        this.resetTeams();
        this.markClean();
      }
    } finally {
      this.loading = false;
    }
  }

  goBack(): void {
    if (this.event) {
      void this.router.navigate(['/event', this.event.objectId]);
    } else {
      void this.router.navigateByUrl('/tabs/peladas');
    }
  }

  onAthletesPerTeamChange(): void {
    this.athletesPerTeam = Math.max(1, Math.min(20, Number(this.athletesPerTeam) || 1));
    this.warnOverCapacity();
  }

  onTeamCountChange(): void {
    const newCount = Math.max(1, Math.min(8, Number(this.teamCount) || 1));
    const resized = resizeTeamsPreservingAssignments(this.teams, this.pool, newCount);
    this.teamCount = newCount;
    this.teams = resized.teams;
    this.pool = resized.pool;
    this.positionGroups = buildPositionGroups(this.pool);
    this.warnOverCapacity();
  }

  resetTeams(): void {
    this.teams = createEmptyTeams(this.teamCount);
    this.pool = [...this.allAthletes];
    this.positionGroups = buildPositionGroups(this.pool);
    this.savedAt = null;
  }

  applyRandomSplit(): void {
    const allAthletes = [...this.allAthletes];
    this.teams = randomTeamSplit(
      allAthletes,
      this.teamCount,
      this.athletesPerTeam,
      this.randomStrategy
    );
    this.pool = allAthletes.filter(
      (athlete) => !this.teams.some((team) => team.some((row) => row.userId === athlete.userId))
    );
    this.positionGroups = buildPositionGroups(this.pool);
    this.savedAt = null;
    this.warnOverCapacity();
  }

  applyPresetSplit(): void {
    const preset = presetFromSplitMode(this.splitMode);
    if (!preset) return;

    this.teamCount = 2;
    const { teams, pool } = presetBinarySplit(this.allAthletes, this.athletesPerTeam, preset, {
      ageThreshold: this.ageThreshold,
    });
    this.teams = teams;
    while (this.teams.length < 2) {
      this.teams.push([]);
    }
    this.pool = pool;
    this.positionGroups = buildPositionGroups(this.pool);
    this.savedAt = null;
    this.warnOverCapacity();
  }

  onAgeThresholdChange(): void {
    this.ageThreshold = Math.max(1, Math.min(99, Number(this.ageThreshold) || 30));
  }

  async saveSplit(): Promise<void> {
    if (!this.event || this.readOnly || this.saving) return;

    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('teamSplit.saving') });
    await loading.present();

    try {
      const saved = await this.teamSplitService.saveSplit({
        eventId: this.event.objectId,
        athletesPerTeam: this.athletesPerTeam,
        teamCount: this.teamCount,
        splitMode: this.splitMode,
        randomStrategy: this.splitMode === 'random' ? this.randomStrategy : undefined,
        ageThreshold: this.splitMode === 'ageSides' ? this.ageThreshold : undefined,
        teams: this.teams.map((team) => team.map((athlete) => athlete.userId)),
      });
      this.savedAt = saved.savedAt ?? null;

      const toast = await this.toastCtrl.create({
        message: this.i18n.t('teamSplit.saveSuccess'),
        duration: 2200,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();
      this.markClean();
    } catch (error: unknown) {
      await this.showError(
        error instanceof Error ? error.message : this.i18n.t('teamSplit.saveFailed')
      );
    } finally {
      this.saving = false;
      await loading.dismiss();
    }
  }

  async confirmClearSavedSplit(): Promise<void> {
    if (!this.event || this.readOnly || this.clearing || !this.hasSavedSplitOnServer) return;

    const alert = await this.alertCtrl.create({
      header: this.i18n.t('teamSplit.clearConfirmTitle'),
      message: this.i18n.t('teamSplit.clearConfirmBody'),
      buttons: [
        { text: this.i18n.t('eventDetail.alert.cancel'), role: 'cancel' },
        {
          text: this.i18n.t('teamSplit.clearSaved'),
          role: 'destructive',
          handler: () => {
            void this.clearSavedSplit();
          },
        },
      ],
    });
    await alert.present();
  }

  async clearSavedSplit(): Promise<void> {
    if (!this.event || this.readOnly || this.clearing) return;

    this.clearing = true;
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('teamSplit.saving') });
    await loading.present();

    try {
      await this.teamSplitService.clearSplit(this.event.objectId);
      this.savedAt = null;
      this.resetTeams();
      this.markClean();

      const toast = await this.toastCtrl.create({
        message: this.i18n.t('teamSplit.clearSuccess'),
        duration: 2200,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();
    } catch (error: unknown) {
      await this.showError(
        error instanceof Error ? error.message : this.i18n.t('teamSplit.clearFailed')
      );
    } finally {
      this.clearing = false;
      await loading.dismiss();
    }
  }

  private captureSnapshot(): string {
    return JSON.stringify({
      athletesPerTeam: this.athletesPerTeam,
      teamCount: this.teamCount,
      splitMode: this.splitMode,
      randomStrategy: this.randomStrategy,
      ageThreshold: this.ageThreshold,
      teams: this.teams.map((team) => team.map((athlete) => athlete.userId)),
    });
  }

  private markClean(): void {
    this.savedSnapshot = this.captureSnapshot();
  }

  formatSavedAt(): string | null {
    if (!this.savedAt) return null;
    const date = new Date(this.savedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(this.i18n.locale);
  }

  private applySavedState(state: EventTeamSplitState): void {
    this.athletesPerTeam = state.athletesPerTeam;
    this.teamCount = state.teamCount;
    this.splitMode = state.splitMode;
    this.randomStrategy = state.randomStrategy ?? 'default';
    this.ageThreshold = state.ageThreshold ?? 30;
    this.savedAt = state.savedAt ?? null;

    const byId = new Map(this.allAthletes.map((athlete) => [athlete.userId, athlete]));
    this.teams = state.teams.map((teamUserIds) =>
      teamUserIds.map((userId) => byId.get(userId)).filter(Boolean) as TeamSplitAthlete[]
    );

    while (this.teams.length < this.teamCount) {
      this.teams.push([]);
    }
    this.teams = this.teams.slice(0, this.teamCount);

    const assignedIds = new Set<string>();
    for (const teamUserIds of state.teams) {
      for (const userId of teamUserIds) {
        assignedIds.add(userId);
      }
    }
    this.pool = this.allAthletes.filter((athlete) => !assignedIds.has(athlete.userId));
    this.positionGroups = buildPositionGroups(this.pool);
    this.markClean();
  }

  onDragStart(athlete: TeamSplitAthlete, fromTeamIndex: number | null): void {
    if (this.readOnly) return;
    this.draggedAthlete = athlete;
    this.draggedFromTeamIndex = fromTeamIndex;
  }

  onDragEnd(): void {
    this.draggedAthlete = null;
    this.draggedFromTeamIndex = null;
  }

  onSplitModeChange(): void {
    if (isBinaryPresetSplitMode(this.splitMode) && this.teamCount !== 2) {
      this.teamCount = 2;
      const resized = resizeTeamsPreservingAssignments(this.teams, this.pool, 2);
      this.teams = resized.teams;
      this.pool = resized.pool;
      this.positionGroups = buildPositionGroups(this.pool);
    }
    this.cancelAssignment();
    this.onDragEnd();
  }

  onDropPool(): void {
    if (this.readOnly || !this.draggedAthlete) return;
    if (this.draggedFromTeamIndex != null) {
      removeAthleteFromTeams(this.teams, this.draggedAthlete.userId);
    } else {
      this.pool = this.pool.filter((row) => row.userId !== this.draggedAthlete!.userId);
    }
    if (!this.pool.some((row) => row.userId === this.draggedAthlete!.userId)) {
      this.pool.push(this.draggedAthlete);
    }
    this.positionGroups = buildPositionGroups(this.pool);
    this.savedAt = null;
    this.onDragEnd();
    this.cancelAssignment();
  }

  onDropTeam(teamIndex: number): void {
    if (this.readOnly || !this.draggedAthlete) return;

    const athlete = this.draggedAthlete;
    if (this.draggedFromTeamIndex != null) {
      removeAthleteFromTeams(this.teams, athlete.userId);
    } else {
      this.pool = this.pool.filter((row) => row.userId !== athlete.userId);
    }

    const existingIndex = this.teams[teamIndex].findIndex((row) => row.userId === athlete.userId);
    if (existingIndex < 0) {
      this.teams[teamIndex].push(athlete);
    }

    this.positionGroups = buildPositionGroups(this.pool);
    this.savedAt = null;
    this.warnOverCapacity();
    this.onDragEnd();
    this.cancelAssignment();
  }

  maritalLabel(status?: TeamSplitAthlete['maritalStatus']): string {
    if (status === 'casado') return this.i18n.t('teamSplit.maritalMarried');
    if (status === 'solteiro') return this.i18n.t('teamSplit.maritalSingle');
    return '';
  }

  footLabel(foot?: TeamSplitAthlete['footPreference']): string {
    if (foot === 'destro') return this.i18n.t('teamSplit.footRight');
    if (foot === 'ambidestro') return this.i18n.t('teamSplit.footBoth');
    if (foot === 'canhoto') return this.i18n.t('teamSplit.footLeft');
    return '';
  }

  private async warnOverCapacity(): Promise<void> {
    const indexes = this.overCapacityTeamIndexes;
    if (!indexes.length) return;

    const labels = indexes
      .map((index) => this.i18n.t('teamSplit.teamName', { number: index + 1 }))
      .join(', ');
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('teamSplit.overCapacityTitle'),
      message: this.i18n.t('teamSplit.overCapacityBody', {
        teams: labels,
        limit: this.athletesPerTeam,
      }),
      buttons: [this.i18n.t('ok')],
    });
    await alert.present();
  }

  private isEventFinished(event: PeladaEvent): boolean {
    return !!event.isFinished || event.endTime < new Date();
  }

  private async enrichEventPeladaSettings(event: PeladaEvent): Promise<PeladaEvent> {
    if (!event.peladaId) return event;

    try {
      const pelada = await this.peladaService.getById(event.peladaId);
      if (!pelada) return event;

      return {
        ...event,
        allowTeamSplitAfterEventEnd: !!pelada.allowTeamSplitAfterEventEnd,
      };
    } catch {
      return event;
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('teamSplit.errorTitle'),
      message,
      buttons: [this.i18n.t('ok')],
    });
    await alert.present();
  }
}

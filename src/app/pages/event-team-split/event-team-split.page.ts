import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { PeladaEvent } from '../../core/models/event.model';
import {
  EventTeamSplitState,
  TeamSplitAthlete,
  TeamSplitMode,
  TeamSplitRandomStrategy,
} from '../../core/models/team-split.model';
import { EventService } from '../../core/services/event.service';
import { PeladaService } from '../../core/services/pelada.service';
import { TeamSplitService } from '../../core/services/team-split.service';
import {
  buildPositionGroups,
  createEmptyTeams,
  randomTeamSplit,
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
  savedAt: string | null = null;
  athletesPerTeam = 5;
  teamCount = 2;
  splitMode: TeamSplitMode = 'manual';
  randomStrategy: TeamSplitRandomStrategy = 'default';

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
    private readonly toastCtrl: ToastController
  ) {}

  get overCapacityTeamIndexes(): number[] {
    return teamsOverCapacity(this.teams, this.athletesPerTeam);
  }

  hasNoAssignedAthletes(): boolean {
    return this.teams.every((team) => team.length === 0);
  }

  formatAthletePoints(points: number): string {
    const value = Number(points) || 0;
    return `${value.toFixed(1)} media votos`;
  }

  formatArrivalOrder(athlete: TeamSplitAthlete): string | null {
    if (athlete.arrivalOrder == null || athlete.arrivalOrder <= 0) return null;
    return `${athlete.arrivalOrder}º na chegada`;
  }

  membershipLabel(athlete: TeamSplitAthlete): string {
    return athlete.isSocio || athlete.membershipType === 'socio' ? 'Socio' : 'Convidado';
  }

  get showTeamAssignmentDock(): boolean {
    return (
      !this.readOnly &&
      this.splitMode === 'manual' &&
      !!this.assignmentAthlete
    );
  }

  get manualAssignmentHint(): string {
    return this.isTouchDevice
      ? 'Toque em um atleta e escolha o time na barra fixa abaixo.'
      : 'Arraste os atletas ou clique para escolher o time na barra abaixo.';
  }

  isAthleteSelected(athlete: TeamSplitAthlete): boolean {
    return this.assignmentAthlete?.userId === athlete.userId;
  }

  canDragAthletes(): boolean {
    return !this.readOnly && this.splitMode === 'manual' && !this.isTouchDevice;
  }

  onAthleteCardTap(athlete: TeamSplitAthlete, fromTeamIndex: number | null): void {
    if (this.readOnly || this.splitMode !== 'manual') return;

    if (this.isAthleteSelected(athlete)) {
      this.cancelAssignment();
      return;
    }

    this.beginAssignment(athlete, fromTeamIndex);
  }

  beginAssignment(athlete: TeamSplitAthlete, fromTeamIndex: number | null): void {
    if (this.readOnly || this.splitMode !== 'manual') return;
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
        await this.showError('Evento nao encontrado.');
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
        await this.showError('Nenhuma separacao de times foi registrada para este evento.');
        this.goBack();
        return;
      } else {
        this.pool = [...athletes];
        this.positionGroups = buildPositionGroups(athletes);
        this.resetTeams();
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

  async saveSplit(): Promise<void> {
    if (!this.event || this.readOnly || this.saving) return;

    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Salvando separacao...' });
    await loading.present();

    try {
      const saved = await this.teamSplitService.saveSplit({
        eventId: this.event.objectId,
        athletesPerTeam: this.athletesPerTeam,
        teamCount: this.teamCount,
        splitMode: this.splitMode,
        randomStrategy: this.splitMode === 'random' ? this.randomStrategy : undefined,
        teams: this.teams.map((team) => team.map((athlete) => athlete.userId)),
      });
      this.savedAt = saved.savedAt ?? null;

      const toast = await this.toastCtrl.create({
        message: 'Separacao de times salva com sucesso.',
        duration: 2200,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Nao foi possivel salvar.');
    } finally {
      this.saving = false;
      await loading.dismiss();
    }
  }

  formatSavedAt(): string | null {
    if (!this.savedAt) return null;
    const date = new Date(this.savedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('pt-BR');
  }

  private applySavedState(state: EventTeamSplitState): void {
    this.athletesPerTeam = state.athletesPerTeam;
    this.teamCount = state.teamCount;
    this.splitMode = state.splitMode;
    this.randomStrategy = state.randomStrategy ?? 'default';
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
    if (status === 'casado') return 'Casado';
    if (status === 'solteiro') return 'Solteiro';
    return '';
  }

  footLabel(foot?: TeamSplitAthlete['footPreference']): string {
    if (foot === 'destro') return 'Destro';
    if (foot === 'ambidestro') return 'Ambidestro';
    if (foot === 'canhoto') return 'Canhoto';
    return '';
  }

  private async warnOverCapacity(): Promise<void> {
    const indexes = this.overCapacityTeamIndexes;
    if (!indexes.length) return;

    const labels = indexes.map((index) => `Time ${index + 1}`).join(', ');
    const alert = await this.alertCtrl.create({
      header: 'Limite de atletas',
      message: `${labels} tem mais atletas que o limite de ${this.athletesPerTeam} por time.`,
      buttons: ['OK'],
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
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ActionSheetController, ViewWillLeave } from '@ionic/angular';
import {
  ScoutApontamentoAthlete,
  ScoutApontamentoBoard,
  SCOUT_GENERAL_STAT_FIELDS,
  SCOUT_GENERAL_STAT_LABELS,
  SCOUT_STAT_GROUPS,
  SCOUT_GOALKEEPER_STAT_GROUPS,
  SCOUT_STAT_LABELS,
  SCOUT_GOAL_METHOD_OPTIONS,
  SCOUT_GOAL_TYPE_FIELDS,
  ScoutStatField,
  computeScoutGoalsTotal,
  isGoalkeeperPosition,
  withComputedScoutGoals,
} from '../../core/models/scout-apontamento.model';
import { ScoutApontamentoService } from '../../core/services/scout-apontamento.service';
import { normalizeSearchText } from '../../core/utils/search-text.util';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';
type MarkingMode = 'individual' | 'general';

@Component({
  selector: 'app-event-scout-apontamento',
  templateUrl: './event-scout-apontamento.page.html',
  styleUrls: ['./event-scout-apontamento.page.scss'],
  standalone: false,
})
export class EventScoutApontamentoPage implements ViewWillLeave {
  eventId = '';
  loading = true;
  board: ScoutApontamentoBoard | null = null;
  athletes: ScoutApontamentoAthlete[] = [];
  generalAthletes: ScoutApontamentoAthlete[] = [];
  selectableAthletes: ScoutApontamentoAthlete[] = [];
  filteredAthletes: ScoutApontamentoAthlete[] = [];
  selectedUserId = '';
  searchTerm = '';
  syncStatus: SyncStatus = 'idle';
  assigning = false;
  markingMode: MarkingMode = 'individual';
  showIndividualPanel = false;
  statGroups = SCOUT_STAT_GROUPS;
  statLabels = SCOUT_STAT_LABELS;
  goalMethodOptions = SCOUT_GOAL_METHOD_OPTIONS;
  generalStatFields = SCOUT_GENERAL_STAT_FIELDS;
  generalStatLabels = SCOUT_GENERAL_STAT_LABELS;

  private saveChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly scoutApontamentoService: ScoutApontamentoService,
    private readonly alertCtrl: AlertController,
    private readonly actionSheetCtrl: ActionSheetController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load();
  }

  ionViewWillLeave(): void {
    void this.flushPendingSaves();
  }

  private markingModeStorageKey(): string {
    return `scout-apontamento-mode:${this.eventId}`;
  }

  private restoreMarkingMode(): void {
    if (!this.eventId || typeof sessionStorage === 'undefined') return;
    const stored = sessionStorage.getItem(this.markingModeStorageKey());
    if (stored === 'individual' || stored === 'general') {
      this.markingMode = stored;
    }
  }

  private persistMarkingMode(): void {
    if (!this.eventId || typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(this.markingModeStorageKey(), this.markingMode);
  }

  get selectedAthlete(): ScoutApontamentoAthlete | null {
    return this.athletes.find((athlete) => athlete.userId === this.selectedUserId) ?? null;
  }

  get isLocked(): boolean {
    return !!this.board?.locked || !!this.board?.viewOnly;
  }

  get isViewOnly(): boolean {
    return !!this.board?.viewOnly;
  }

  get needsAssignment(): boolean {
    return !!this.board?.canAssign && !this.isViewOnly;
  }

  get assignedAthleteLabel(): string {
    const assignedId = this.board?.assignedAthleteUserId;
    if (!assignedId) return '';
    const athlete = this.generalAthletes.find((row) => row.userId === assignedId);
    return athlete?.apelido || athlete?.userName || 'Atleta';
  }

  get syncLabel(): string {
    switch (this.syncStatus) {
      case 'saving':
        return 'Salvando...';
      case 'saved':
        return 'Salvo';
      case 'error':
        return 'Erro ao salvar';
      default:
        return '';
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.applyFilter();
  }

  onMarkingModeChange(mode: MarkingMode): void {
    this.markingMode = mode;
    this.persistMarkingMode();
    if (mode === 'individual') {
      this.showIndividualPanel = false;
    }
    this.applyFilter();
    this.cdr.markForCheck();
  }

  selectAthlete(userId: string): void {
    this.selectedUserId = userId;
    this.showIndividualPanel = true;
    this.cdr.markForCheck();
  }

  backToAthleteSelection(): void {
    this.showIndividualPanel = false;
    this.cdr.markForCheck();
  }

  async assignSelectedAthlete(): Promise<void> {
    const athlete = this.selectedAthlete;
    if (!athlete || !this.eventId || this.isLocked || this.assigning) return;

    this.assigning = true;
    try {
      await this.scoutApontamentoService.assignAthlete(this.eventId, athlete.userId);
      await this.load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atribuir atleta.';
      const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
      await alert.present();
    } finally {
      this.assigning = false;
      this.cdr.markForCheck();
    }
  }

  isReadOnlyStatField(field: ScoutStatField): boolean {
    return (
      field === 'goals' ||
      field === 'foulsCommitted' ||
      field === 'foulsSuffered' ||
      field === 'saves' ||
      field === 'goalsConceded' ||
      SCOUT_GOAL_TYPE_FIELDS.includes(field)
    );
  }

  statGroupsForAthlete(athlete: ScoutApontamentoAthlete): Array<{ title: string; fields: ScoutStatField[] }> {
    const attackFields = isGoalkeeperPosition(athlete.primaryPosition)
      ? (['ownGoals'] as ScoutStatField[])
      : (['shotsOffTarget', 'shotsOnTarget', 'ownGoals', 'assists'] as ScoutStatField[]);

    const groups = SCOUT_STAT_GROUPS.map((group) =>
      group.title === 'Ataque' ? { ...group, fields: attackFields } : group
    );

    if (isGoalkeeperPosition(athlete.primaryPosition)) {
      return [...groups, ...SCOUT_GOALKEEPER_STAT_GROUPS];
    }
    return groups;
  }

  goalTypeBreakdown(athlete: ScoutApontamentoAthlete): Array<{ field: ScoutStatField; label: string; count: number }> {
    return SCOUT_GOAL_METHOD_OPTIONS.map((option) => ({
      field: option.field,
      label: option.label,
      count: athlete.stats[option.field],
    })).filter((row) => row.count > 0);
  }

  async promptRegisterGoal(athlete: ScoutApontamentoAthlete): Promise<void> {
    if (this.isLocked) return;

    const sheet = await this.actionSheetCtrl.create({
      header: 'Como foi o gol?',
      subHeader: 'Selecione apenas uma forma por gol convertido.',
      buttons: [
        ...SCOUT_GOAL_METHOD_OPTIONS.map((option) => ({
          text: option.label,
          handler: () => {
            void this.adjustStatForAthlete(athlete, option.field, 1);
          },
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async promptRemoveGoal(athlete: ScoutApontamentoAthlete): Promise<void> {
    if (this.isLocked || computeScoutGoalsTotal(athlete.stats) <= 0) return;

    const options = this.goalTypeBreakdown(athlete);
    if (!options.length) return;

    const sheet = await this.actionSheetCtrl.create({
      header: 'Remover qual gol?',
      buttons: [
        ...options.map((option) => ({
          text: `${option.label} (${option.count})`,
          handler: () => {
            void this.adjustStatForAthlete(athlete, option.field, -1);
          },
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async promptRegisterGoalForSelected(): Promise<void> {
    const athlete = this.selectedAthlete;
    if (!athlete) return;
    await this.promptRegisterGoal(athlete);
  }

  async promptRemoveGoalForSelected(): Promise<void> {
    const athlete = this.selectedAthlete;
    if (!athlete) return;
    await this.promptRemoveGoal(athlete);
  }

  statValue(athlete: ScoutApontamentoAthlete, field: ScoutStatField): number {
    if (field === 'goals') {
      return computeScoutGoalsTotal(athlete.stats);
    }
    return athlete.stats[field];
  }

  async adjustStat(field: ScoutStatField, delta: 1 | -1): Promise<void> {
    const athlete = this.selectedAthlete;
    if (!athlete) return;
    await this.adjustStatForAthlete(athlete, field, delta);
  }

  async adjustStatForAthlete(
    athlete: ScoutApontamentoAthlete,
    field: ScoutStatField,
    delta: 1 | -1
  ): Promise<void> {
    if (this.isLocked || field === 'goals') return;

    const previousStats = { ...athlete.stats };
    const current = athlete.stats[field];
    if (delta < 0 && current <= 0) return;

    const athleteUserId = athlete.userId;
    athlete.stats[field] = Math.max(0, current + delta);
    athlete.stats = withComputedScoutGoals(athlete.stats);
    this.syncStatus = 'saving';
    this.cdr.markForCheck();

    this.saveChain = this.saveChain
      .then(() => this.scoutApontamentoService.incrementStat(this.eventId, athleteUserId, field, delta))
      .then((stats) => {
        const target =
          this.generalAthletes.find((row) => row.userId === athleteUserId) ??
          this.athletes.find((row) => row.userId === athleteUserId);
        if (target) {
          target.stats = withComputedScoutGoals(stats);
        }
        this.syncStatus = 'saved';
        this.cdr.markForCheck();
      })
      .catch(async (error: unknown) => {
        const target =
          this.generalAthletes.find((row) => row.userId === athleteUserId) ??
          this.athletes.find((row) => row.userId === athleteUserId);
        if (target) {
          target.stats = previousStats;
        }
        this.syncStatus = 'error';
        this.cdr.markForCheck();
        const message = error instanceof Error ? error.message : 'Erro ao salvar apontamento.';
        const alert = await this.alertCtrl.create({
          header: 'Erro',
          message,
          buttons: ['OK'],
        });
        await alert.present();
      });

    await this.saveChain;
  }

  private async flushPendingSaves(): Promise<void> {
    await this.saveChain;
  }

  private async load(): Promise<void> {
    if (!this.eventId) {
      this.loading = false;
      return;
    }

    await this.flushPendingSaves();
    this.loading = true;
    try {
      this.board = await this.scoutApontamentoService.loadBoard(this.eventId);
      this.athletes = this.board.athletes;
      this.generalAthletes = this.board.allAthletes ?? this.board.athletes;
      this.selectableAthletes = this.board.selectableAthletes ?? this.board.athletes;
      this.restoreMarkingMode();
      if (this.isViewOnly) {
        this.markingMode = 'general';
      } else if (
        this.needsAssignment &&
        typeof sessionStorage !== 'undefined' &&
        !sessionStorage.getItem(this.markingModeStorageKey())
      ) {
        // Sem preferencia salva: abre no Geral (atribuicao individual e opcional ate o usuario escolher).
        this.markingMode = 'general';
      }
      this.applyFilter();
      if (this.filteredAthletes.length) {
        this.selectedUserId = this.board.assignedAthleteUserId || this.filteredAthletes[0].userId;
      } else if (this.needsAssignment && this.selectableAthletes.length) {
        this.selectedUserId = this.selectableAthletes[0].userId;
      }
      this.showIndividualPanel = false;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar apontamento.';
      const alert = await this.alertCtrl.create({
        header: 'Apontamento scout',
        message,
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private applyFilter(): void {
    // Individual + atribuicao pendente: so atletas livres. Geral: todos os participantes.
    const source =
      this.markingMode === 'individual' && this.needsAssignment
        ? this.selectableAthletes
        : this.markingMode === 'individual' && this.board?.assignedAthleteUserId
          ? this.athletes
          : this.generalAthletes;
    const term = normalizeSearchText(this.searchTerm);
    if (!term) {
      this.filteredAthletes = [...source];
      return;
    }

    this.filteredAthletes = source.filter((athlete) => {
      const haystack = normalizeSearchText(
        `${athlete.apelido} ${athlete.userName} ${athlete.primaryPosition ?? ''}`
      );
      return haystack.includes(term);
    });

    if (
      this.selectedUserId &&
      !this.filteredAthletes.some((athlete) => athlete.userId === this.selectedUserId)
    ) {
      this.selectedUserId = this.filteredAthletes[0]?.userId ?? '';
      this.showIndividualPanel = false;
    }
  }
}

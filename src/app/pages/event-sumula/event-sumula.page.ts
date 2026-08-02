import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  RefereeSumulaAthlete,
  RefereeSumulaBoard,
  REFEREE_SUMULA_STAT_FIELDS,
  REFEREE_SUMULA_STAT_LABELS,
  RefereeSumulaStatField,
} from '../../core/models/referee-sumula.model';
import { RefereeSumulaService } from '../../core/services/referee-sumula.service';
import { normalizeSearchText } from '../../core/utils/search-text.util';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-event-sumula',
  templateUrl: './event-sumula.page.html',
  styleUrls: ['./event-sumula.page.scss'],
  standalone: false,
})
export class EventSumulaPage {
  eventId = '';
  loading = true;
  saving = false;
  board: RefereeSumulaBoard | null = null;
  athletes: RefereeSumulaAthlete[] = [];
  filteredAthletes: RefereeSumulaAthlete[] = [];
  searchTerm = '';
  syncStatus: SyncStatus = 'idle';
  dirty = false;
  statFields = REFEREE_SUMULA_STAT_FIELDS;
  statLabels = REFEREE_SUMULA_STAT_LABELS;

  /** Evita aplicar resposta de carregamento de outro evento (pagina cacheada pelo Ionic). */
  private loadToken = 0;
  private loadedEventId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly refereeSumulaService: RefereeSumulaService,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    const nextEventId = this.route.snapshot.paramMap.get('id') ?? '';
    const eventChanged = nextEventId !== this.loadedEventId;
    this.eventId = nextEventId;

    if (eventChanged) {
      this.resetBoardState();
    }

    void this.load();
  }

  get isLocked(): boolean {
    return !!this.board?.locked || this.board?.canEdit === false;
  }

  /** Somente leitura por perfil (nao-juiz/admin), com evento ainda em andamento. */
  get isViewOnly(): boolean {
    return this.board?.canEdit === false && !this.board?.locked;
  }

  get lockMessage(): string {
    if (this.board?.locked) {
      return 'Evento encerrado — sumula em modo consulta para qualquer perfil.';
    }
    if (this.isViewOnly) {
      return 'Fora do periodo de sumula (juiz) — edicao indisponivel. Apos o encerramento do evento, a sumula fica em consulta para todos.';
    }
    return 'Sumula em modo consulta.';
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
        return this.dirty ? 'Alteracoes pendentes' : '';
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.applyFilter();
  }

  adjustStat(athlete: RefereeSumulaAthlete, field: RefereeSumulaStatField, delta: 1 | -1): void {
    if (this.isLocked) return;

    const statsKey = field === 'foulsCommitted' ? 'fouls' : field;
    const current = athlete.stats[statsKey as 'goals' | 'fouls' | 'yellowCards' | 'redCards'];
    if (delta < 0 && current <= 0) return;

    athlete.stats[statsKey as 'goals' | 'fouls' | 'yellowCards' | 'redCards'] = Math.max(
      0,
      current + delta
    );
    this.dirty = true;
    this.syncStatus = 'idle';
    this.cdr.markForCheck();
  }

  onObservationChange(athlete: RefereeSumulaAthlete, value: string): void {
    if (this.isLocked) return;
    athlete.stats.observation = value;
    this.dirty = true;
    this.syncStatus = 'idle';
    this.cdr.markForCheck();
  }

  async saveSumula(): Promise<void> {
    const activeEventId = this.route.snapshot.paramMap.get('id') ?? '';
    if (
      this.isLocked ||
      !activeEventId ||
      activeEventId !== this.eventId ||
      this.board?.eventId !== activeEventId ||
      this.saving
    ) {
      return;
    }

    this.saving = true;
    this.syncStatus = 'saving';
    this.cdr.markForCheck();

    try {
      const entries = this.athletes.map((athlete) => ({
        athleteUserId: athlete.userId,
        stats: athlete.stats,
      }));
      await this.refereeSumulaService.saveBoard(activeEventId, entries);
      this.dirty = false;
      this.syncStatus = 'saved';
      const alert = await this.alertCtrl.create({
        header: 'Sumula salva',
        message: 'Os apontamentos da sumula foram salvos com sucesso.',
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error: unknown) {
      this.syncStatus = 'error';
      const message = error instanceof Error ? error.message : 'Erro ao salvar sumula.';
      const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
      await alert.present();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  statValue(athlete: RefereeSumulaAthlete, field: RefereeSumulaStatField): number {
    if (field === 'foulsCommitted') return athlete.stats.fouls;
    if (field === 'goals') return athlete.stats.goals;
    if (field === 'yellowCards') return athlete.stats.yellowCards;
    if (field === 'redCards') return athlete.stats.redCards;
    if (field === 'penaltiesCommitted') return athlete.stats.penaltiesCommitted;
    if (field === 'penaltiesSuffered') return athlete.stats.penaltiesSuffered;
    return 0;
  }

  private resetBoardState(): void {
    this.board = null;
    this.athletes = [];
    this.filteredAthletes = [];
    this.searchTerm = '';
    this.dirty = false;
    this.syncStatus = 'idle';
    this.saving = false;
  }

  private async load(): Promise<void> {
    if (!this.eventId) {
      this.loading = false;
      this.resetBoardState();
      return;
    }

    const requestedEventId = this.eventId;
    const token = ++this.loadToken;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const board = await this.refereeSumulaService.loadBoard(requestedEventId);
      if (token !== this.loadToken || this.eventId !== requestedEventId) {
        return;
      }
      if (board.eventId && board.eventId !== requestedEventId) {
        throw new Error('A sumula carregada nao corresponde a este evento. Tente novamente.');
      }

      this.board = board;
      this.loadedEventId = requestedEventId;
      this.athletes = board.athletes.map((athlete) => ({
        ...athlete,
        stats: { ...athlete.stats },
      }));
      this.dirty = false;
      this.syncStatus = 'idle';
      this.applyFilter();
    } catch (error: unknown) {
      if (token !== this.loadToken || this.eventId !== requestedEventId) {
        return;
      }
      this.resetBoardState();
      const message = error instanceof Error ? error.message : 'Erro ao carregar sumula.';
      const alert = await this.alertCtrl.create({
        header: 'Sumula do evento',
        message,
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private applyFilter(): void {
    const term = normalizeSearchText(this.searchTerm);
    if (!term) {
      this.filteredAthletes = [...this.athletes];
      return;
    }

    this.filteredAthletes = this.athletes.filter((athlete) => {
      const haystack = normalizeSearchText(
        `${athlete.apelido} ${athlete.userName} ${athlete.primaryPosition ?? ''}`
      );
      return haystack.includes(term);
    });
  }
}

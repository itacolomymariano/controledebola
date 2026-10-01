import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  RefereeSumulaAthlete,
  RefereeSumulaBoard,
  REFEREE_SUMULA_STAT_FIELDS,
  REFEREE_SUMULA_GOALKEEPER_STAT_FIELDS,
  REFEREE_SUMULA_STAT_LABELS,
  RefereeSumulaStatField,
} from '../../core/models/referee-sumula.model';
import { RefereeSumulaService } from '../../core/services/referee-sumula.service';
import { normalizeSearchText } from '../../core/utils/search-text.util';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SumulaTeamSection {
  side: 'home' | 'away' | 'other';
  title: string;
  athletes: RefereeSumulaAthlete[];
}

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
  teamSections: SumulaTeamSection[] = [];
  searchTerm = '';
  syncStatus: SyncStatus = 'idle';
  dirty = false;
  statFields = REFEREE_SUMULA_STAT_FIELDS;
  goalkeeperExtraFields = REFEREE_SUMULA_GOALKEEPER_STAT_FIELDS;
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

  get isTeamMatch(): boolean {
    return this.board?.eventType === 'team_match';
  }

  get homeTeamName(): string {
    return this.board?.homeTeamName || 'Mandante';
  }

  get awayTeamName(): string {
    return this.board?.awayTeamName || 'Visitante';
  }

  /** Placar vivo: soma dos gols anotados pelo arbitro por time. */
  get homeScore(): number {
    if (!this.isTeamMatch) return 0;
    return this.sumGoalsForSide('home');
  }

  get awayScore(): number {
    if (!this.isTeamMatch) return 0;
    return this.sumGoalsForSide('away');
  }

  get lockMessage(): string {
    if (this.board?.locked) {
      return this.isTeamMatch
        ? 'Evento encerrado — sumula em consulta para todos os usuarios.'
        : 'Evento encerrado — sumula em modo consulta para qualquer perfil.';
    }
    if (this.isViewOnly) {
      return this.isTeamMatch
        ? 'Consulta disponivel para todos. Edicao apenas pelo arbitro na faixa de data/hora da sumula.'
        : 'Fora do periodo de sumula (juiz) — edicao indisponivel. Apos o encerramento do evento, a sumula fica em consulta para todos.';
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

  fieldsForAthlete(athlete: RefereeSumulaAthlete): RefereeSumulaStatField[] {
    if (athlete.role === 'goalkeeper') {
      return [...this.statFields.slice(0, 1), ...this.goalkeeperExtraFields, ...this.statFields.slice(1)];
    }
    return this.statFields;
  }

  async adjustStat(
    athlete: RefereeSumulaAthlete,
    field: RefereeSumulaStatField,
    delta: 1 | -1
  ): Promise<void> {
    if (this.isLocked) return;

    const statsKey =
      field === 'foulsCommitted' ? 'fouls' : field === 'goalsConceded' ? 'goalsConceded' : field;
    const current = Number(
      athlete.stats[statsKey as keyof typeof athlete.stats] as number | undefined
    ) || 0;
    if (delta < 0 && current <= 0) return;

    const next = Math.max(0, current + delta);

    if (this.isTeamMatch && field === 'goalsConceded' && delta > 0) {
      const side = athlete.teamSide === 'home' || athlete.teamSide === 'away' ? athlete.teamSide : null;
      if (side) {
        const teamConceded = this.sumConcededForSide(side) - current + next;
        const opponentGoals = this.sumGoalsForSide(side === 'home' ? 'away' : 'home');
        if (teamConceded > opponentGoals) {
          const alert = await this.alertCtrl.create({
            header: 'Limite de gols sofridos',
            message: `A soma de gols sofridos dos goleiros deste time nao pode ultrapassar os gols do adversario (${opponentGoals}).`,
            buttons: ['OK'],
          });
          await alert.present();
          return;
        }
      }
    }

    if (this.isTeamMatch && field === 'goals' && delta < 0) {
      const side = athlete.teamSide === 'home' || athlete.teamSide === 'away' ? athlete.teamSide : null;
      if (side) {
        const nextTeamGoals = this.sumGoalsForSide(side) - current + next;
        const opponentConceded = this.sumConcededForSide(side === 'home' ? 'away' : 'home');
        if (opponentConceded > nextTeamGoals) {
          const alert = await this.alertCtrl.create({
            header: 'Ajuste invalido',
            message:
              'Reduzir estes gols deixaria os gols sofridos dos goleiros adversarios acima do placar. Ajuste os gols sofridos primeiro.',
            buttons: ['OK'],
          });
          await alert.present();
          return;
        }
      }
    }

    if (statsKey === 'fouls') athlete.stats.fouls = next;
    else if (statsKey === 'goalsConceded') athlete.stats.goalsConceded = next;
    else if (statsKey === 'goals') athlete.stats.goals = next;
    else if (statsKey === 'yellowCards') athlete.stats.yellowCards = next;
    else if (statsKey === 'redCards') athlete.stats.redCards = next;
    else if (statsKey === 'penaltiesCommitted') athlete.stats.penaltiesCommitted = next;
    else if (statsKey === 'penaltiesSuffered') athlete.stats.penaltiesSuffered = next;
    this.dirty = true;
    this.syncStatus = 'idle';
    if (field === 'goals' && this.board) {
      this.board.homeScore = this.homeScore;
      this.board.awayScore = this.awayScore;
    }
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
    if (field === 'goalsConceded') return athlete.stats.goalsConceded || 0;
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
    this.teamSections = [];
    this.searchTerm = '';
    this.dirty = false;
    this.syncStatus = 'idle';
    this.saving = false;
  }

  /** Placar: somente gols marcados (nao inclui gols sofridos de goleiro). */
  private sumGoalsForSide(side: 'home' | 'away'): number {
    return this.athletes.reduce((total, athlete) => {
      if (athlete.teamSide !== side) return total;
      return total + Math.max(0, Number(athlete.stats.goals || 0));
    }, 0);
  }

  private sumConcededForSide(side: 'home' | 'away'): number {
    return this.athletes.reduce((total, athlete) => {
      if (athlete.teamSide !== side || athlete.role !== 'goalkeeper') return total;
      return total + Math.max(0, Number(athlete.stats.goalsConceded || 0));
    }, 0);
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
    } else {
      this.filteredAthletes = this.athletes.filter((athlete) => {
        const haystack = normalizeSearchText(
          `${athlete.apelido} ${athlete.userName} ${athlete.primaryPosition ?? ''} ${athlete.teamName ?? ''}`
        );
        return haystack.includes(term);
      });
    }
    this.rebuildTeamSections();
  }

  private rebuildTeamSections(): void {
    if (!this.isTeamMatch) {
      this.teamSections = this.filteredAthletes.length
        ? [{ side: 'other', title: 'Atletas', athletes: this.filteredAthletes }]
        : [];
      return;
    }

    const home: RefereeSumulaAthlete[] = [];
    const away: RefereeSumulaAthlete[] = [];
    const other: RefereeSumulaAthlete[] = [];
    for (const athlete of this.filteredAthletes) {
      if (athlete.teamSide === 'home') home.push(athlete);
      else if (athlete.teamSide === 'away') away.push(athlete);
      else other.push(athlete);
    }

    const sections: SumulaTeamSection[] = [];
    if (home.length) {
      sections.push({ side: 'home', title: this.homeTeamName, athletes: home });
    }
    if (away.length) {
      sections.push({ side: 'away', title: this.awayTeamName, athletes: away });
    }
    if (other.length) {
      sections.push({ side: 'other', title: 'Sem time definido', athletes: other });
    }
    this.teamSections = sections;
  }
}

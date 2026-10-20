import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  MURAL_TARGET_ROLE_LABELS,
  MuralTargetRole,
} from '../../core/models/event-performance.model';
import { PeladaParticipant } from '../../core/models/pelada-participant.model';
import { MuralHighlights } from '../../core/models/mural-highlights.model';
import { MuralParticipantLocationStats } from '../../core/models/mural-participant-stats.model';
import { MuralShareContext } from '../../core/models/mural-share.model';
import { MuralRankingEntry } from '../../core/models/mural.model';
import { MuralHighlightsService } from '../../core/services/mural-highlights.service';
import { MuralParticipantStatsService } from '../../core/services/mural-participant-stats.service';
import { MuralService } from '../../core/services/mural.service';
import { MuralShareService } from '../../core/services/mural-share.service';
import { EventMediaService } from '../../core/services/event-media.service';
import { RegistrationService } from '../../core/services/registration.service';
import { SupportRoleToolsService } from '../../core/services/support-role-tools.service';
import { AthletePerformanceService, MuralPerformanceAnalytics } from '../../core/services/athlete-performance.service';
import {
  buildMuralRankingDisplaySections,
  MuralRankingDisplaySection,
} from '../../core/utils/mural-ranking-display.util';
import { resolveRouteParam } from '../../core/utils/route-param.util';

/** Perfis sob "Outros TOP 10..." no mural do evento (pelada e confronto). */
const EVENT_OTHER_TOP10_ROLES: MuralTargetRole[] = [
  'referee',
  'journalist',
  'cameraman',
  'narrator',
  'gandula',
];

const EVENT_PRIMARY_TOP10_ROLES: MuralTargetRole[] = ['athlete', 'goalkeeper'];

const EVENT_NOTAS_ROLES: MuralTargetRole[] = ['scout', 'masseur', 'kitman'];

export type EventMuralViewId =
  | 'root'
  | 'top10'
  | 'top10-athlete'
  | 'top10-goalkeeper'
  | 'top10-other'
  | 'top10-role'
  | 'scout'
  | 'scout-qualitative'
  | 'scout-quantitative'
  | 'scout-charts'
  | 'scout-goal-types'
  | 'notas'
  | 'notas-role'
  | 'curiosities'
  | 'curiosities-location'
  | 'curiosities-pro-team'
  | 'curiosities-amateur-team'
  | 'curiosities-height'
  | 'curiosities-fan-checkins';

export interface EventMuralStackFrame {
  id: EventMuralViewId;
  role?: MuralTargetRole;
}

@Component({
  selector: 'app-event-mural',
  templateUrl: './event-mural.page.html',
  styleUrls: ['./event-mural.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventMuralPage {
  eventId = '';
  loading = true;
  errorMessage = '';
  loadFailed = false;
  participants: PeladaParticipant[] = [];
  muralRankings: Record<MuralTargetRole, MuralRankingEntry[]> = {} as Record<
    MuralTargetRole,
    MuralRankingEntry[]
  >;
  primaryRankingSections: MuralRankingDisplaySection[] = [];
  otherRankingSections: MuralRankingDisplaySection[] = [];
  notasRankingSections: MuralRankingDisplaySection[] = [];
  muralHighlights: MuralHighlights | null = null;
  participantStats: MuralParticipantLocationStats | null = null;
  performanceAnalytics: MuralPerformanceAnalytics | null = null;
  shareContext: MuralShareContext | null = null;
  cloudUnavailable = false;
  voterQuorumMet = true;
  minVotersForHighlights = 3;
  fanCheckInCount = 0;
  viewStack: EventMuralStackFrame[] = [{ id: 'root' }];
  showExtrasMedia = false;
  showExtrasPredictions = false;
  mediaHasRadio = false;
  mediaHasJournal = false;
  mediaHasVideo = false;
  mediaJournalHeadline = '';
  mediaRadioTitle = '';
  mediaVideoTitle = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly muralService: MuralService,
    private readonly muralHighlightsService: MuralHighlightsService,
    private readonly muralParticipantStatsService: MuralParticipantStatsService,
    private readonly muralShareService: MuralShareService,
    private readonly registrationService: RegistrationService,
    private readonly eventMediaService: EventMediaService,
    private readonly supportTools: SupportRoleToolsService,
    private readonly performanceService: AthletePerformanceService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get currentView(): EventMuralStackFrame {
    return this.viewStack[this.viewStack.length - 1] ?? { id: 'root' };
  }

  get isRoot(): boolean {
    return this.currentView.id === 'root';
  }

  get drillTitle(): string {
    const view = this.currentView;
    switch (view.id) {
      case 'top10':
        return 'Top 10';
      case 'top10-athlete':
        return 'Top 10 — Atleta';
      case 'top10-goalkeeper':
        return 'Top 10 — Goleiro';
      case 'top10-other':
        return 'Outros Top 10';
      case 'top10-role':
        return view.role ? `Top 10 — ${MURAL_TARGET_ROLE_LABELS[view.role]}` : 'Top 10';
      case 'scout':
        return 'Apontamentos do Scout';
      case 'scout-qualitative':
        return 'Desempenho qualitativo';
      case 'scout-quantitative':
        return 'Desempenho quantitativo';
      case 'scout-charts':
        return 'Gráficos de desempenho';
      case 'scout-goal-types':
        return 'Tipos de gols';
      case 'notas':
        return 'Notas individuais';
      case 'notas-role':
        return view.role ? `Notas — ${MURAL_TARGET_ROLE_LABELS[view.role]}` : 'Notas individuais';
      case 'curiosities':
        return 'Curiosidades do evento';
      case 'curiosities-location':
        return 'Participantes por localização';
      case 'curiosities-pro-team':
        return 'Time profissional mais amado';
      case 'curiosities-amateur-team':
        return 'Time amador mais amado';
      case 'curiosities-height':
        return 'Atletas mais alto e mais baixo';
      case 'curiosities-fan-checkins':
        return 'Torcedores com check-in';
      default:
        return 'Mural do evento';
    }
  }

  ionViewWillEnter(): void {
    this.eventId = resolveRouteParam(this.route, 'id');
    this.viewStack = [{ id: 'root' }];
    void this.load();
  }

  retry(): void {
    void this.load();
  }

  pushView(id: EventMuralViewId, role?: MuralTargetRole): void {
    this.viewStack = [...this.viewStack, { id, role }];
    this.cdr.markForCheck();
  }

  popView(): void {
    if (this.viewStack.length <= 1) return;
    this.viewStack = this.viewStack.slice(0, -1);
    this.cdr.markForCheck();
  }

  closeDrillToRoot(): void {
    this.viewStack = [{ id: 'root' }];
    this.cdr.markForCheck();
  }

  toggleExtrasMedia(): void {
    this.showExtrasMedia = !this.showExtrasMedia;
    this.cdr.markForCheck();
  }

  toggleExtrasPredictions(): void {
    this.showExtrasPredictions = !this.showExtrasPredictions;
    this.cdr.markForCheck();
  }

  openMediaHub(): void {
    if (!this.eventId) return;
    void this.router.navigate(['/event', this.eventId, 'mural', 'media']);
  }

  openMediaJournal(): void {
    if (!this.eventId) return;
    void this.router.navigate(['/event', this.eventId, 'mural', 'media', 'journal']);
  }

  openMediaRadio(): void {
    if (!this.eventId) return;
    void this.router.navigate(['/event', this.eventId, 'mural', 'media', 'radio']);
  }

  openMediaVideo(): void {
    if (!this.eventId) return;
    void this.router.navigate(['/event', this.eventId, 'mural', 'media', 'video']);
  }

  rankingSectionForRole(role: MuralTargetRole): MuralRankingDisplaySection | undefined {
    return (
      this.primaryRankingSections.find((s) => s.role === role) ??
      this.otherRankingSections.find((s) => s.role === role) ??
      this.notasRankingSections.find((s) => s.role === role)
    );
  }

  notasSectionForRole(role: MuralTargetRole): MuralRankingDisplaySection | undefined {
    return this.notasRankingSections.find((s) => s.role === role);
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.loadFailed = false;
    this.cdr.markForCheck();

    if (!this.eventId) {
      this.eventId = resolveRouteParam(this.route, 'id');
    }
    if (!this.eventId) {
      this.errorMessage = 'Evento nao identificado. Volte ao detalhe do evento e abra o mural novamente.';
      this.loadFailed = true;
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      await this.ensureParticipants().catch(() => undefined);
      await this.loadMural();
      await Promise.all([
        this.loadShareContext().catch(() => undefined),
        this.loadMediaPreview().catch(() => undefined),
        this.loadFanCheckInCount().catch(() => undefined),
      ]);
    } catch (error: unknown) {
      console.warn('event-mural load failed', error);
      this.errorMessage = 'Nao foi possivel carregar o mural do evento. Tente novamente.';
      this.loadFailed = true;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadShareContext(): Promise<void> {
    if (!this.eventId) {
      this.shareContext = null;
      return;
    }
    this.shareContext = await this.muralShareService.buildContextForEventId(this.eventId);
  }

  private async ensureParticipants(): Promise<void> {
    if (!this.eventId) return;
    this.participants = await this.registrationService.listParticipantsForEvent(this.eventId);
  }

  private async loadFanCheckInCount(): Promise<void> {
    this.fanCheckInCount = 0;
    if (!this.eventId) return;
    try {
      const snapshot = await this.supportTools.getEventSupportOpsSnapshot(this.eventId);
      this.fanCheckInCount = snapshot?.fan?.checkIns ?? 0;
    } catch {
      this.fanCheckInCount = 0;
    }
  }

  private async loadMediaPreview(): Promise<void> {
    this.mediaHasRadio = false;
    this.mediaHasJournal = false;
    this.mediaHasVideo = false;
    this.mediaJournalHeadline = '';
    this.mediaRadioTitle = '';
    this.mediaVideoTitle = '';
    if (!this.eventId) return;
    try {
      const dashboard = await this.eventMediaService.loadDashboard(this.eventId);
      if (!dashboard.cloudAvailable) return;
      this.mediaHasJournal = !!(dashboard.journalReportage || dashboard.journalInterview);
      this.mediaHasRadio = !!(dashboard.radioNarration || dashboard.radioInterview);
      this.mediaHasVideo = !!dashboard.highlightVideo;
      this.mediaJournalHeadline =
        dashboard.journalReportage?.headline || dashboard.journalInterview?.headline || '';
      this.mediaRadioTitle =
        dashboard.radioNarration?.title || dashboard.radioInterview?.title || '';
      this.mediaVideoTitle = dashboard.highlightVideo?.title || '';
    } catch (error: unknown) {
      console.warn('event-mural media preview failed', error);
    }
  }

  private async loadMural(): Promise<void> {
    const dashboard = await this.muralService.loadEventMuralDashboard(this.eventId);
    this.cloudUnavailable = !dashboard.cloudAvailable;
    this.voterQuorumMet = dashboard.voteSummary?.voterQuorumMet !== false;
    this.minVotersForHighlights = dashboard.voteSummary?.minVoters || 3;

    if (dashboard.participants?.length) {
      this.participants = this.muralService.mapCloudParticipants(dashboard.participants);
    }

    this.muralRankings = dashboard.rankings ?? ({} as Record<MuralTargetRole, MuralRankingEntry[]>);
    this.primaryRankingSections = buildMuralRankingDisplaySections(
      EVENT_PRIMARY_TOP10_ROLES,
      this.muralRankings,
      (role) => MURAL_TARGET_ROLE_LABELS[role]
    );
    this.otherRankingSections = buildMuralRankingDisplaySections(
      EVENT_OTHER_TOP10_ROLES,
      this.muralRankings,
      (role) => MURAL_TARGET_ROLE_LABELS[role]
    );
    this.notasRankingSections = buildMuralRankingDisplaySections(
      EVENT_NOTAS_ROLES,
      this.muralRankings,
      (role) => MURAL_TARGET_ROLE_LABELS[role]
    );

    try {
      if (dashboard.locationStats) {
        this.participantStats = {
          total: dashboard.locationStats.total,
          byState: dashboard.locationStats.byState ?? [],
          byCity: dashboard.locationStats.byCity ?? [],
          byNeighborhood: dashboard.locationStats.byNeighborhood ?? [],
        };
      } else {
        const participantIds = this.participants.map((participant) => participant.userId);
        this.participantStats = await this.muralParticipantStatsService.getLocationStats(
          'event',
          this.eventId,
          participantIds,
          this.participants
        );
      }
    } catch (error: unknown) {
      console.warn('event-mural location stats failed', error);
      this.participantStats = null;
    }

    try {
      this.performanceAnalytics = await this.performanceService.loadMuralAnalytics(
        'event',
        this.eventId
      );
    } catch {
      this.performanceAnalytics = null;
    }

    try {
      this.muralHighlights = await this.muralHighlightsService.getHighlights(
        'event',
        this.eventId,
        this.participants.map((participant) => participant.userId),
        this.participants,
        this.muralRankings
      );
    } catch (error: unknown) {
      console.warn('event-mural highlights failed', error);
      this.muralHighlights = null;
    }

    if (this.cloudUnavailable) {
      this.errorMessage =
        'Publique o Cloud Code atualizado no Back4App para carregar rankings e estatisticas completas.';
    }

    this.cdr.markForCheck();
  }
}

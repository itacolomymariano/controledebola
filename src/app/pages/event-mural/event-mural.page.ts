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
import { EventService } from '../../core/services/event.service';
import { MuralHighlightsService } from '../../core/services/mural-highlights.service';
import { MuralParticipantStatsService } from '../../core/services/mural-participant-stats.service';
import { MuralService } from '../../core/services/mural.service';
import { MuralShareService } from '../../core/services/mural-share.service';
import { EventMediaService } from '../../core/services/event-media.service';
import { PeladaService } from '../../core/services/pelada.service';
import { RegistrationService } from '../../core/services/registration.service';
import {
  buildMuralRankingDisplaySections,
  MuralRankingDisplaySection,
} from '../../core/utils/mural-ranking-display.util';
import { resolveRouteParam } from '../../core/utils/route-param.util';

/** Perfis de apoio exibidos sob "Outros TOP 10..." no mural do evento. */
const EVENT_OTHER_TOP10_ROLES: MuralTargetRole[] = [
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
];

const EVENT_PRIMARY_TOP10_ROLES: MuralTargetRole[] = ['athlete', 'goalkeeper'];

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
  /** Falha dura do dashboard — esconde o conteudo. Avisos soft (ex.: cloud) usam so errorMessage. */
  loadFailed = false;
  participants: PeladaParticipant[] = [];
  muralRankings: Record<MuralTargetRole, MuralRankingEntry[]> = {} as Record<
    MuralTargetRole,
    MuralRankingEntry[]
  >;
  rankingSections: MuralRankingDisplaySection[] = [];
  primaryRankingSections: MuralRankingDisplaySection[] = [];
  otherRankingSections: MuralRankingDisplaySection[] = [];
  muralHighlights: MuralHighlights | null = null;
  participantStats: MuralParticipantLocationStats | null = null;
  shareContext: MuralShareContext | null = null;
  cloudUnavailable = false;
  voterQuorumMet = true;
  minVotersForHighlights = 3;
  muralRoles = Object.keys(MURAL_TARGET_ROLE_LABELS) as MuralTargetRole[];
  showPredictionRankings = false;
  showOtherTop10 = false;
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
    private readonly eventService: EventService,
    private readonly peladaService: PeladaService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    this.eventId = resolveRouteParam(this.route, 'id');
    void this.load();
  }

  retry(): void {
    void this.load();
  }

  togglePredictionRankings(): void {
    this.showPredictionRankings = !this.showPredictionRankings;
    this.cdr.markForCheck();
  }

  toggleOtherTop10(): void {
    this.showOtherTop10 = !this.showOtherTop10;
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
      // Preview de midia e participantes nao podem derrubar o mural inteiro.
      await this.loadMural();
      await Promise.all([
        this.loadShareContext().catch(() => undefined),
        this.loadMediaPreview().catch(() => undefined),
        this.ensureParticipants().catch(() => undefined),
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
    const event = await this.eventService.getById(this.eventId);
    if (!event) {
      this.shareContext = { scope: 'event' };
      return;
    }
    const pelada = event.peladaId ? await this.peladaService.getById(event.peladaId) : null;
    this.shareContext = this.muralShareService.contextFromEvent(event, pelada);
  }

  private async ensureParticipants(): Promise<void> {
    if (this.participants.length || !this.eventId) return;
    this.participants = await this.registrationService.listParticipantsForEvent(this.eventId);
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
    this.rankingSections = buildMuralRankingDisplaySections(
      this.muralRoles,
      this.muralRankings,
      (role) => MURAL_TARGET_ROLE_LABELS[role]
    );
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

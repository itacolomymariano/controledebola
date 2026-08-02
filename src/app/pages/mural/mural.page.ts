import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { RefresherCustomEvent } from '@ionic/angular';
import {
  MURAL_TARGET_ROLE_LABELS,
  MuralTargetRole,
} from '../../core/models/event-performance.model';
import { PeladaParticipant } from '../../core/models/pelada-participant.model';
import { MuralRankingEntry } from '../../core/models/mural.model';
import { MuralLocationTopRankings } from '../../core/models/mural-location-top.model';
import { MuralHighlights } from '../../core/models/mural-highlights.model';
import { MuralParticipantLocationStats } from '../../core/models/mural-participant-stats.model';
import { MuralShareContext } from '../../core/models/mural-share.model';
import { PredictionRankingEntry } from '../../core/models/fan-prediction.model';
import { MuralHighlightsService } from '../../core/services/mural-highlights.service';
import { MuralService } from '../../core/services/mural.service';
import {
  MuralPerformanceAnalytics,
} from '../../core/services/athlete-performance.service';
import {
  buildMuralRankingDisplaySections,
  MuralRankingDisplaySection,
} from '../../core/utils/mural-ranking-display.util';

const MURAL_APP_TOP10_ROLE_LABELS: Record<MuralTargetRole, string> = {
  athlete: 'Atletas',
  goalkeeper: 'Goleiros',
  referee: 'Juízes / Árbitros',
  scout: 'Scouts / Mesários',
  journalist: 'Jornalistas',
  cameraman: 'Cinegrafistas',
  narrator: 'Narradores',
  coach: 'Treinadores',
  physical_trainer: 'Preparadores Físicos',
  masseur: 'Massagistas',
  kitman: 'Roupeiros',
  gandula: 'Gandulas',
};

@Component({
  selector: 'app-mural',
  templateUrl: './mural.page.html',
  styleUrls: ['./mural.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralPage {
  loading = true;
  errorMessage = '';
  participants: PeladaParticipant[] = [];
  muralRankings: Record<MuralTargetRole, MuralRankingEntry[]> = {} as Record<
    MuralTargetRole,
    MuralRankingEntry[]
  >;
  rankingSections: MuralRankingDisplaySection[] = [];
  muralHighlights: MuralHighlights | null = null;
  participantStats: MuralParticipantLocationStats | null = null;
  locationTopRankings: MuralLocationTopRankings | null = null;
  performanceAnalytics: MuralPerformanceAnalytics | null = null;
  predictionEntries: PredictionRankingEntry[] = [];
  dashboardFromCloud = false;
  muralRoles = Object.keys(MURAL_TARGET_ROLE_LABELS) as MuralTargetRole[];
  readonly shareContext: MuralShareContext = { scope: 'app' };

  constructor(
    private readonly muralService: MuralService,
    private readonly muralHighlightsService: MuralHighlightsService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  retry(): void {
    void this.load();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    event.target.complete();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const dashboard = await this.muralService.loadAppDashboard();
      this.dashboardFromCloud = dashboard.cloudAvailable;
      this.participants = dashboard.participants;
      this.muralRankings = dashboard.rankings;
      this.rankingSections = buildMuralRankingDisplaySections(
        this.muralRoles,
        dashboard.rankings,
        (role) => MURAL_APP_TOP10_ROLE_LABELS[role]
      );
      this.participantStats = dashboard.locationStats;
      this.locationTopRankings = dashboard.locationTopRankings;
      this.predictionEntries = dashboard.predictionRankings;
      this.performanceAnalytics = dashboard.performanceAnalytics as MuralPerformanceAnalytics | null;

      const participantIds = this.participants.map((participant) => participant.userId);
      this.muralHighlights = await this.muralHighlightsService.getHighlights(
        'app',
        undefined,
        participantIds,
        this.participants,
        dashboard.rankings,
        dashboard.voteAggregates
      );

      if (!dashboard.cloudAvailable) {
        this.errorMessage =
          'Alguns dados do mural podem estar incompletos. Publique o Cloud Code mais recente no Back4App.';
      }
    } catch {
      this.errorMessage = 'Nao foi possivel carregar o mural. Tente novamente.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { RefresherCustomEvent } from '@ionic/angular';
import {
  MuralAppTab,
  muralTabToBucket,
  muralTabToShareVariant,
} from '../../core/config/mural-app-sections.config';
import { MuralHighlights } from '../../core/models/mural-highlights.model';
import { MuralLocationTopRankings } from '../../core/models/mural-location-top.model';
import { MuralParticipantLocationStats } from '../../core/models/mural-participant-stats.model';
import { MURAL_APP_SHARE_HEADERS, MuralShareContext } from '../../core/models/mural-share.model';
import {
  MuralAppBucketPayload,
  MuralAppDashboard,
  MuralAppTeamRankEntry,
  MuralCoachRankEntry,
  MuralLocationFilter,
  MuralLocationOption,
  MuralTeamMatchDashboard,
} from '../../core/models/mural.model';
import { muralFilterCaption } from '../../core/utils/mural-filter-caption.util';
import {
  displayCityName,
  displayNeighborhoodName,
} from '../../core/utils/mural-location-drilldown.util';
import { PeladaParticipant } from '../../core/models/pelada-participant.model';
import {
  MuralPerformanceAnalytics,
} from '../../core/services/athlete-performance.service';
import { MuralHighlightsService } from '../../core/services/mural-highlights.service';
import { MuralService } from '../../core/services/mural.service';

/** Valor sentinela das opcoes "Todo o Brasil" / "Todas as cidades" / "Todos os bairros". */
const ALL_LOCATIONS = '__ALL__';

@Component({
  selector: 'app-mural',
  templateUrl: './mural.page.html',
  styleUrls: ['./mural.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralPage {
  readonly allLocations = ALL_LOCATIONS;

  muralTab: MuralAppTab = 'geral';
  loading = true;
  errorMessage = '';
  participants: PeladaParticipant[] = [];
  dashboard: MuralAppDashboard | null = null;
  teamMatchDashboard: MuralTeamMatchDashboard | null = null;
  stateOptions: MuralLocationOption[] = [];
  cityOptions: MuralLocationOption[] = [];
  neighborhoodOptions: MuralLocationOption[] = [];
  selectedState = '';
  selectedCity = '';
  selectedNeighborhood = '';
  highlightsByTab: Partial<Record<MuralAppTab, MuralHighlights | null>> = {};
  participantStats: MuralParticipantLocationStats | null = null;
  locationTopRankings: MuralLocationTopRankings | null = null;
  performanceAnalytics: MuralPerformanceAnalytics | null = null;
  dashboardFromCloud = false;
  /** Descarta destaques de um load() anterior que ainda esteja em voo. */
  private muralLoadSeq = 0;
  /** Fallback quando o bucket do dashboard vem sem tops (Cloud antigo ou lista vazia). */
  private teamRankFallback: {
    topTeams: MuralAppTeamRankEntry[];
    topCoaches: MuralCoachRankEntry[];
  } | null = null;

  constructor(
    private readonly muralService: MuralService,
    private readonly muralHighlightsService: MuralHighlightsService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    void this.loadStateOptions();
    void this.load();
  }

  retry(): void {
    void this.load();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await Promise.all([this.loadStateOptions(), this.load()]);
    event.target.complete();
  }

  // ----- Filtro de regiao (Estado > Cidade > Bairro) -----

  get hasLocationFilter(): boolean {
    return !!(this.selectedState || this.selectedCity || this.selectedNeighborhood);
  }

  /** Esconde a barra quando a Cloud antiga nao responde `getMuralLocationOptions`. */
  get showLocationFilter(): boolean {
    return this.stateOptions.length > 0 || this.hasLocationFilter;
  }

  get activeLocationLabel(): string {
    return [
      this.stateLabel(this.selectedState),
      displayCityName(this.cityLabel(this.selectedCity)),
      displayNeighborhoodName(this.neighborhoodLabel(this.selectedNeighborhood)),
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' - ');
  }

  cityOptionLabel(option: MuralLocationOption): string {
    return displayCityName(option.label);
  }

  neighborhoodOptionLabel(option: MuralLocationOption): string {
    return displayNeighborhoodName(option.label);
  }

  async onStateFilterChange(event: CustomEvent): Promise<void> {
    const value = this.normalizeSelectValue(event);
    if (value === this.selectedState) return;
    this.selectedState = value;
    this.selectedCity = '';
    this.selectedNeighborhood = '';
    this.cityOptions = [];
    this.neighborhoodOptions = [];
    this.cdr.markForCheck();
    if (value) {
      this.cityOptions = await this.muralService.loadLocationOptions('city', { state: value });
      this.cdr.markForCheck();
    }
    await this.load();
  }

  async onCityFilterChange(event: CustomEvent): Promise<void> {
    const value = this.normalizeSelectValue(event);
    if (value === this.selectedCity) return;
    this.selectedCity = value;
    this.selectedNeighborhood = '';
    this.neighborhoodOptions = [];
    this.cdr.markForCheck();
    if (value) {
      this.neighborhoodOptions = await this.muralService.loadLocationOptions('neighborhood', {
        state: this.selectedState,
        city: value,
      });
      this.cdr.markForCheck();
    }
    await this.load();
  }

  async onNeighborhoodFilterChange(event: CustomEvent): Promise<void> {
    const value = this.normalizeSelectValue(event);
    if (value === this.selectedNeighborhood) return;
    this.selectedNeighborhood = value;
    this.cdr.markForCheck();
    await this.load();
  }

  async clearLocationFilter(): Promise<void> {
    if (!this.hasLocationFilter) return;
    this.selectedState = '';
    this.selectedCity = '';
    this.selectedNeighborhood = '';
    this.cityOptions = [];
    this.neighborhoodOptions = [];
    this.cdr.markForCheck();
    await this.load();
  }

  private normalizeSelectValue(event: CustomEvent): string {
    const raw = String((event.detail as { value?: unknown })?.value ?? '');
    return raw === ALL_LOCATIONS ? '' : raw;
  }

  private async loadStateOptions(): Promise<void> {
    const options = await this.muralService.loadLocationOptions('state');
    this.stateOptions = options;
    this.cdr.markForCheck();
  }

  private activeLocationFilter(): MuralLocationFilter {
    return {
      state: this.selectedState || undefined,
      city: this.selectedCity || undefined,
      neighborhood: this.selectedNeighborhood || undefined,
    };
  }

  private stateLabel(key: string): string {
    if (!key) return '';
    return this.stateOptions.find((option) => option.key === key)?.label || key;
  }

  private cityLabel(key: string): string {
    if (!key) return '';
    return this.cityOptions.find((option) => option.key === key)?.label || key;
  }

  private neighborhoodLabel(key: string): string {
    if (!key) return '';
    return this.neighborhoodOptions.find((option) => option.key === key)?.label || key;
  }

  onMuralTabChange(event: CustomEvent): void {
    const value = event.detail.value;
    if (value === 'geral' || value === 'peladas' || value === 'confrontos') {
      this.muralTab = value;
      this.cdr.markForCheck();
    }
  }

  get locationFilterCaption(): string {
    return muralFilterCaption(this.appFilterLabels());
  }

  shareContextForTab(tab: MuralAppTab): MuralShareContext {
    const variant = muralTabToShareVariant(tab);
    const filter = this.appFilterLabels();
    return {
      scope: 'app',
      appMuralVariant: variant,
      cardTitle: MURAL_APP_SHARE_HEADERS[variant],
      appFilterState: filter.state,
      appFilterCity: filter.city,
      appFilterNeighborhood: filter.neighborhood,
    };
  }

  private appFilterLabels(): { state?: string; city?: string; neighborhood?: string } {
    return {
      state: this.stateLabel(this.selectedState) || undefined,
      city: displayCityName(this.cityLabel(this.selectedCity)) || undefined,
      neighborhood:
        displayNeighborhoodName(this.neighborhoodLabel(this.selectedNeighborhood)) || undefined,
    };
  }

  bucketForTab(tab: MuralAppTab): MuralAppBucketPayload | null {
    const key = muralTabToBucket(tab);
    const base = this.dashboard?.buckets?.[key] ?? this.fallbackBucketForTab(tab);
    if (!base) return null;
    return this.mergeTeamRanksIntoBucket(base);
  }

  private mergeTeamRanksIntoBucket(payload: MuralAppBucketPayload): MuralAppBucketPayload {
    const fb = this.teamRankFallback;
    if (!fb) return payload;
    return {
      ...payload,
      topTeams: payload.topTeams?.length ? payload.topTeams : fb.topTeams,
      topCoaches: payload.topCoaches?.length ? payload.topCoaches : fb.topCoaches,
    };
  }

  highlightsForTab(tab: MuralAppTab): MuralHighlights | null {
    return this.highlightsByTab[tab] ?? null;
  }

  private fallbackBucketForTab(tab: MuralAppTab): MuralAppBucketPayload | null {
    if (!this.dashboard) return null;
    const rankings =
      tab === 'peladas'
        ? this.dashboard.rankingsPelada
        : tab === 'confrontos'
          ? this.dashboard.rankingsTeamMatch
          : this.dashboard.rankings;
    if (!rankings) return null;
    return {
      bucket: muralTabToBucket(tab),
      rankings,
      voteAggregates:
        tab === 'peladas'
          ? (this.dashboard.voteAggregatesPelada ?? this.dashboard.voteAggregates)
          : tab === 'confrontos'
            ? (this.dashboard.voteAggregatesTeamMatch ?? this.dashboard.voteAggregates)
            : this.dashboard.voteAggregates,
      topScorers: rankings.athlete ?? [],
      topTeams: [],
      topCoaches: rankings.coach ?? [],
      predictionRankings: this.dashboard.predictionRankings,
    };
  }

  private async load(): Promise<void> {
    const generation = ++this.muralLoadSeq;
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    let dashboard: MuralAppDashboard;
    try {
      const filter = this.activeLocationFilter();
      const [appDashboard, teamMatchDashboard] = await Promise.all([
        this.muralService.loadAppDashboard(filter),
        this.muralService.loadTeamMatchDashboard(filter),
      ]);
      if (generation !== this.muralLoadSeq) return;

      this.teamMatchDashboard = teamMatchDashboard;
      dashboard = this.enrichDashboardTeamRanks(appDashboard, teamMatchDashboard);
      this.dashboard = dashboard;
      this.dashboardFromCloud = dashboard.cloudAvailable;
      this.participants = dashboard.participants;
      this.participantStats = dashboard.locationStats;
      this.locationTopRankings = dashboard.locationTopRankings;
      this.performanceAnalytics = dashboard.performanceAnalytics as MuralPerformanceAnalytics | null;

      if (!dashboard.cloudAvailable) {
        this.errorMessage =
          'Alguns dados do mural podem estar incompletos. Publique o Cloud Code mais recente no Back4App.';
      }
    } catch {
      if (generation !== this.muralLoadSeq) return;
      this.errorMessage = 'Nao foi possivel carregar o mural. Tente novamente.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = false;
    this.cdr.markForCheck();

    const tabs: MuralAppTab[] = ['geral', 'peladas', 'confrontos'];
    await Promise.all(
      tabs.map(async (tab) => {
        try {
          const bucket = this.bucketFromDashboard(dashboard, tab);
          const highlights = await this.muralHighlightsService.getHighlights(
            'app',
            undefined,
            this.participants.map((p) => p.userId),
            this.participants,
            bucket?.rankings,
            bucket?.voteAggregates ?? null,
            { appBucket: muralTabToBucket(tab) }
          );
          if (generation !== this.muralLoadSeq) return;
          this.highlightsByTab = { ...this.highlightsByTab, [tab]: highlights };
          this.cdr.markForCheck();
        } catch {
          // Rankings ja atribuidos permanecem; esta aba fica sem destaque novo.
        }
      })
    );
  }

  private enrichDashboardTeamRanks(
    dashboard: MuralAppDashboard,
    teamDash: MuralTeamMatchDashboard
  ): MuralAppDashboard {
    const merged = dashboard.buckets?.merged;
    const teamMatch = dashboard.buckets?.team_match;
    const needsTeams =
      !merged?.topTeams?.length ||
      !merged?.topCoaches?.length ||
      !teamMatch?.topTeams?.length;
    if (!needsTeams) {
      this.teamRankFallback = null;
      return dashboard;
    }

    this.teamRankFallback = {
      topTeams: teamDash.topTeams ?? [],
      topCoaches: teamDash.topCoaches ?? [],
    };
    if (!teamDash.topTeams?.length && !teamDash.topCoaches?.length) {
      return dashboard;
    }
    const buckets = { ...(dashboard.buckets ?? {}) };
    const patch = (payload: MuralAppBucketPayload | undefined): MuralAppBucketPayload | undefined => {
      if (!payload) return payload;
      return {
        ...payload,
        topTeams: payload.topTeams?.length ? payload.topTeams : (teamDash.topTeams ?? []),
        topCoaches: payload.topCoaches?.length
          ? payload.topCoaches
          : (teamDash.topCoaches ?? []),
      };
    };
    if (buckets.merged) buckets.merged = patch(buckets.merged)!;
    if (buckets.team_match) buckets.team_match = patch(buckets.team_match)!;
    return { ...dashboard, buckets };
  }

  private bucketFromDashboard(
    dashboard: MuralAppDashboard,
    tab: MuralAppTab
  ): MuralAppBucketPayload | null {
    const key = muralTabToBucket(tab);
    if (dashboard.buckets?.[key]) {
      return dashboard.buckets[key] ?? null;
    }
    if (tab === 'geral') {
      return {
        bucket: 'merged',
        rankings: dashboard.rankings,
        voteAggregates: dashboard.voteAggregates,
        topScorers: [],
        topTeams: [],
        topCoaches: dashboard.rankings.coach ?? [],
        predictionRankings: dashboard.predictionRankings,
      };
    }
    if (tab === 'peladas' && dashboard.rankingsPelada) {
      return {
        bucket: 'pelada',
        rankings: dashboard.rankingsPelada,
        voteAggregates: dashboard.voteAggregatesPelada ?? dashboard.voteAggregates,
        topScorers: [],
        topTeams: [],
        topCoaches: [],
        predictionRankings: dashboard.predictionRankings,
      };
    }
    if (tab === 'confrontos' && dashboard.rankingsTeamMatch) {
      return {
        bucket: 'team_match',
        rankings: dashboard.rankingsTeamMatch,
        voteAggregates: dashboard.voteAggregatesTeamMatch ?? dashboard.voteAggregates,
        topScorers: [],
        topTeams: [],
        topCoaches: dashboard.rankingsTeamMatch.coach ?? [],
        predictionRankings: dashboard.predictionRankings,
      };
    }
    return null;
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { EventType, PeladaEvent } from '../../core/models/event.model';
import { ProfileRole } from '../../core/models/profile-role.model';
import {
  ALL_SEARCH_PROFILE_OPTIONS,
  isLegendSearchKind,
  ProfileSearchResult,
  SearchProfileKind,
} from '../../core/models/profile-search.model';
import { AmateurLegendAthlete, AmateurLegendTeam } from '../../core/models/amateur-legend.model';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';
import { ProfileSearchService } from '../../core/services/profile-search.service';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';

type SearchSegment = 'eventos' | 'perfis';

interface EventSearchRow {
  event: PeladaEvent;
  typeLabel: string;
  dateLabel: string;
  locationLabel: string;
}

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SearchPage {
  segment: SearchSegment = 'eventos';
  eventRows: EventSearchRow[] = [];
  profileResults: ProfileSearchResult[] = [];
  legendAthleteResults: AmateurLegendAthlete[] = [];
  legendTeamResults: AmateurLegendTeam[] = [];
  eventQuery = '';
  profileQuery = '';
  selectedEventType: EventType | '' = '';
  selectedProfileKind: SearchProfileKind = 'athlete';
  profileKindOptions = ALL_SEARCH_PROFILE_OPTIONS;
  searched = false;
  loading = false;
  errorMessage = '';
  eventSearchSeq = 0;
  profileSearchSeq = 0;

  eventTypes: { value: EventType | ''; label: string }[] = [
    { value: '', label: 'Todos os tipos' },
    { value: 'pelada', label: 'Pelada' },
    { value: 'racha', label: 'Racha' },
    { value: 'team_match', label: 'Jogo entre equipes' },
  ];

  constructor(
    private readonly auth: AuthService,
    private readonly eventService: EventService,
    private readonly profileSearchService: ProfileSearchService,
    private readonly legendService: AmateurLegendService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get isLegendSearch(): boolean {
    return isLegendSearchKind(this.selectedProfileKind);
  }

  get selectedEventTypeLabel(): string {
    return this.eventTypes.find((option) => option.value === this.selectedEventType)?.label ?? 'evento';
  }

  get selectedProfileKindLabel(): string {
    return this.profileKindOptions.find((option) => option.role === this.selectedProfileKind)?.label ?? '';
  }

  get showCreateLegendPrompt(): boolean {
    if (!this.searched || this.loading || !this.profileQuery.trim()) return false;
    if (this.selectedProfileKind === 'legend_athlete') {
      return this.legendAthleteResults.length === 0;
    }
    if (this.selectedProfileKind === 'legend_team') {
      return this.legendTeamResults.length === 0;
    }
    return false;
  }

  onSegmentChange(): void {
    this.searched = false;
    this.eventRows = [];
    this.profileResults = [];
    this.legendAthleteResults = [];
    this.legendTeamResults = [];
    this.eventQuery = '';
    this.profileQuery = '';
    this.errorMessage = '';

    if (this.segment === 'perfis' && !this.isLegendSearch) {
      void this.profileSearchService.preloadCatalog(this.selectedProfileKind as ProfileRole);
    }
    this.cdr.markForCheck();
  }

  onEventTypeChange(): void {
    this.eventRows = [];
    this.searched = false;
    this.eventQuery = '';
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  onEventSearchInput(event: CustomEvent): void {
    const value = (event.detail.value as string | null | undefined) ?? '';
    this.eventQuery = value;
    void this.runEventSearch(value);
  }

  onEventSearchClear(): void {
    this.eventQuery = '';
    this.eventRows = [];
    this.searched = false;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  onProfileKindChange(): void {
    this.profileResults = [];
    this.legendAthleteResults = [];
    this.legendTeamResults = [];
    this.searched = false;
    this.profileQuery = '';
    this.errorMessage = '';
    if (!this.isLegendSearch) {
      void this.profileSearchService.preloadCatalog(this.selectedProfileKind as ProfileRole);
    }
    this.cdr.markForCheck();
  }

  onProfileSearchInput(event: CustomEvent): void {
    const value = (event.detail.value as string | null | undefined) ?? '';
    this.profileQuery = value;
    void this.runProfileSearch(value);
  }

  onProfileSearchClear(): void {
    this.profileQuery = '';
    this.profileResults = [];
    this.legendAthleteResults = [];
    this.legendTeamResults = [];
    this.searched = false;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  retrySearch(): void {
    this.errorMessage = '';
    if (this.segment === 'eventos') {
      void this.runEventSearch(this.eventQuery);
      return;
    }
    void this.runProfileSearch(this.profileQuery);
  }

  private async runEventSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.eventRows = [];
      this.searched = false;
      this.loading = false;
      this.errorMessage = '';
      this.cdr.markForCheck();
      return;
    }

    const seq = ++this.eventSearchSeq;
    this.loading = true;
    this.searched = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const results = await this.eventService.search({
        query: trimmed,
        type: (this.selectedEventType || undefined) as EventType | undefined,
      });
      if (seq !== this.eventSearchSeq) return;
      this.eventRows = results.map((event) => this.toEventSearchRow(event));
    } catch (error: unknown) {
      if (seq !== this.eventSearchSeq) return;
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.eventRows = [];
      this.errorMessage =
        error instanceof Error ? error.message : 'Nao foi possivel buscar eventos.';
    } finally {
      if (seq === this.eventSearchSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async runProfileSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.profileResults = [];
      this.legendAthleteResults = [];
      this.legendTeamResults = [];
      this.searched = false;
      this.loading = false;
      this.errorMessage = '';
      this.cdr.markForCheck();
      return;
    }

    const seq = ++this.profileSearchSeq;
    this.loading = true;
    this.searched = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      if (this.selectedProfileKind === 'legend_athlete') {
        const results = await this.legendService.listAthletes(trimmed);
        if (seq !== this.profileSearchSeq) return;
        this.legendAthleteResults = results;
        this.legendTeamResults = [];
        this.profileResults = [];
      } else if (this.selectedProfileKind === 'legend_team') {
        const results = await this.legendService.listTeams(trimmed);
        if (seq !== this.profileSearchSeq) return;
        this.legendTeamResults = results;
        this.legendAthleteResults = [];
        this.profileResults = [];
      } else {
        const results = await this.profileSearchService.search(this.selectedProfileKind, trimmed);
        if (seq !== this.profileSearchSeq) return;
        this.profileResults = results;
        this.legendAthleteResults = [];
        this.legendTeamResults = [];
      }
    } catch (error: unknown) {
      if (seq !== this.profileSearchSeq) return;
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.profileResults = [];
      this.legendAthleteResults = [];
      this.legendTeamResults = [];
      this.errorMessage =
        error instanceof Error ? error.message : 'Nao foi possivel buscar perfis.';
    } finally {
      if (seq === this.profileSearchSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  openEvent(row: EventSearchRow): void {
    void this.router.navigate(['/event', row.event.objectId]);
  }

  openProfile(result: ProfileSearchResult): void {
    if (!result.userId?.trim()) return;
    if (result.role === 'athlete') {
      void this.router.navigate(['/athlete', result.userId]);
      return;
    }
    void this.router.navigate(['/profile', result.role, result.userId]);
  }

  openLegendAthlete(legend: AmateurLegendAthlete): void {
    if (!legend.id?.trim()) return;
    void this.router.navigate(['/legends/athlete', legend.id]);
  }

  goCreateLegendAthlete(): void {
    const term = this.profileQuery.trim();
    void this.router.navigate(['/legends/athlete/new'], {
      queryParams: { name: term, apelido: term },
    });
  }

  goCreateLegendTeam(): void {
    const term = this.profileQuery.trim();
    void this.router.navigate(['/legends/team/new'], {
      queryParams: { name: term, apelido: term },
    });
  }

  private toEventSearchRow(event: PeladaEvent): EventSearchRow {
    return {
      event,
      typeLabel: this.eventService.formatType(event.type),
      dateLabel: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(event.startTime),
      locationLabel: [event.address.city, event.address.state].filter(Boolean).join(' - '),
    };
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { FOOTBALL_POSITIONS } from '../../core/models/athlete-profile.model';
import { EventType, PeladaEvent } from '../../core/models/event.model';
import { ProfileRole } from '../../core/models/profile-role.model';
import {
  formatAthleteBodyLabel,
  isLegendSearchKind,
  ProfileSearchResult,
  SearchProfileKind,
  SEARCHABLE_PROFILE_ROLES,
} from '../../core/models/profile-search.model';
import { I18nService } from '../../core/services/i18n.service';
import { localizedProfileRoleLabel } from '../../core/utils/profile-role-i18n.util';
import { AmateurLegendAthlete, AmateurLegendTeam } from '../../core/models/amateur-legend.model';
import { TeamDirectoryKind, TeamPickerRow } from '../../core/models/team.model';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';
import { ProfileSearchService } from '../../core/services/profile-search.service';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';
import { TeamService } from '../../core/services/team.service';
import { isParseObjectId } from '../../core/utils/parse-object-id.util';
import { loggedUserAddress } from '../peladas/home-directory.util';
import { PlayfulCardTone } from '../../shared/components/playful-card/playful-card.component';
import { formatAppDateTime } from '../../core/utils/locale-datetime.util';

type SearchSegment = 'eventos' | 'perfis' | 'times';

interface EventSearchRow {
  event: PeladaEvent;
  title: string;
  eventNameLine?: string;
  typeLabel: string;
  dateLabel: string;
  locationLabel: string;
  scoreLabel?: string;
}

interface TeamMatchHistoryRow {
  eventId: string;
  name: string;
  startTime: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  isFinished: boolean;
  result: string;
}

interface TeamSearchRow {
  team: TeamPickerRow;
  expanded: boolean;
  loadingHistory: boolean;
  history: TeamMatchHistoryRow[];
}

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SearchPage implements OnInit, OnDestroy {
  private localeSub?: Subscription;
  private readonly eventTones: PlayfulCardTone[] = ['peladas', 'confrontos', 'times', 'users'];
  private readonly profileTones: PlayfulCardTone[] = ['users', 'peladas', 'confrontos', 'times'];

  eventPlayfulTone(index: number): PlayfulCardTone {
    return this.eventTones[index % this.eventTones.length];
  }

  profilePlayfulTone(index: number): PlayfulCardTone {
    return this.profileTones[index % this.profileTones.length];
  }

  legendPlayfulTone(index: number): PlayfulCardTone {
    return this.eventTones[(index + 1) % this.eventTones.length];
  }
  segment: SearchSegment = 'eventos';
  eventRows: EventSearchRow[] = [];
  profileResults: ProfileSearchResult[] = [];
  legendAthleteResults: AmateurLegendAthlete[] = [];
  legendTeamResults: AmateurLegendTeam[] = [];
  teamRows: TeamSearchRow[] = [];
  eventQuery = '';
  eventNeighborhood = '';
  profileQuery = '';
  teamQuery = '';
  teamKind: TeamDirectoryKind = 'active';
  selectedEventType: EventType | '' = '';
  selectedAthletePosition = '';
  selectedProfileKind: SearchProfileKind = 'athlete';
  athletePositionOptions: Array<{ value: string; label: string }> = [];
  profileKindOptions: Array<{ role: SearchProfileKind; label: string }> = [];
  searched = false;
  loading = false;
  errorMessage = '';
  eventSearchSeq = 0;
  profileSearchSeq = 0;
  teamSearchSeq = 0;

  eventTypes: { value: EventType | ''; label: string }[] = [];

  constructor(
    private readonly auth: AuthService,
    private readonly eventService: EventService,
    private readonly profileSearchService: ProfileSearchService,
    private readonly legendService: AmateurLegendService,
    private readonly teamService: TeamService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    readonly i18n: I18nService
  ) {}

  get searchbarRemountKey(): string {
    return this.i18n.ionInputRemountKey;
  }

  ngOnInit(): void {
    this.rebuildLocalizedFilters();
    this.localeSub = this.i18n.locale$.subscribe(() => {
      this.rebuildLocalizedFilters();
    });
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  private rebuildLocalizedFilters(): void {
    this.eventTypes = [
      { value: '', label: this.i18n.t('search.eventType.all') },
      { value: 'pelada', label: this.i18n.t('event.type.pelada') },
      { value: 'racha', label: this.i18n.t('event.type.racha') },
      { value: 'team_match', label: this.i18n.t('event.type.team_match') },
    ];
    this.profileKindOptions = [
      ...SEARCHABLE_PROFILE_ROLES.map((role) => ({
        role,
        label: localizedProfileRoleLabel(this.i18n, role),
      })),
      { role: 'legend_athlete', label: this.i18n.t('search.legendAthlete') },
      { role: 'legend_team', label: this.i18n.t('search.legendTeam') },
    ];
    this.athletePositionOptions = [
      { value: '', label: this.i18n.t('search.position.all') },
      ...FOOTBALL_POSITIONS.map((position) => ({ value: position, label: position })),
    ];
    this.cdr.markForCheck();
  }

  get isLegendSearch(): boolean {
    return isLegendSearchKind(this.selectedProfileKind);
  }

  get selectedEventTypeLabel(): string {
    return (
      this.eventTypes.find((option) => option.value === this.selectedEventType)?.label ??
      this.i18n.t('search.eventType.any')
    );
  }

  get eventSearchPlaceholder(): string {
    return this.i18n.t('search.placeholder.event', {
      type: this.selectedEventTypeLabel.toLowerCase(),
    });
  }

  get profileSearchPlaceholder(): string {
    return this.i18n.t('search.placeholder.profile', {
      role: this.selectedProfileKindLabel.toLowerCase(),
    });
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

  selectSegment(segment: SearchSegment): void {
    if (this.segment === segment) return;
    this.segment = segment;
    this.onSegmentChange();
  }

  onSegmentChange(): void {
    this.searched = false;
    this.eventRows = [];
    this.profileResults = [];
    this.legendAthleteResults = [];
    this.legendTeamResults = [];
    this.teamRows = [];
    this.eventQuery = '';
    this.eventNeighborhood = '';
    this.profileQuery = '';
    this.teamQuery = '';
    this.teamKind = 'active';
    this.selectedAthletePosition = '';
    this.errorMessage = '';

    this.cdr.markForCheck();
  }

  onEventTypeChange(): void {
    this.eventRows = [];
    this.searched = false;
    this.eventQuery = '';
    this.errorMessage = '';
    this.cdr.markForCheck();
    if (this.eventNeighborhood.trim()) {
      void this.runEventSearch('');
    }
  }

  onNeighborhoodInput(event: CustomEvent): void {
    const value = (event.detail.value as string | null | undefined) ?? '';
    this.eventNeighborhood = value;
    void this.runEventSearch(this.eventQuery);
  }

  onEventSearchInput(event: CustomEvent): void {
    const value = (event.detail.value as string | null | undefined) ?? '';
    this.eventQuery = value;
    void this.runEventSearch(value);
  }

  onEventSearchClear(): void {
    this.eventQuery = '';
    if (this.eventNeighborhood.trim()) {
      void this.runEventSearch('');
      return;
    }
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
    this.selectedAthletePosition = '';
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  onProfileSearchInput(event: CustomEvent): void {
    const value = (event.detail.value as string | null | undefined) ?? '';
    this.profileQuery = value;
    void this.runProfileSearch(value);
  }

  onAthletePositionChange(): void {
    void this.runProfileSearch(this.profileQuery);
  }

  onProfileSearchClear(): void {
    this.profileQuery = '';
    if (this.selectedProfileKind === 'athlete' && this.selectedAthletePosition.trim()) {
      void this.runProfileSearch('');
      return;
    }
    this.profileResults = [];
    this.legendAthleteResults = [];
    this.legendTeamResults = [];
    this.searched = false;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  athleteBodyLabel(profile: ProfileSearchResult): string {
    if (profile.role !== 'athlete') return '';
    return formatAthleteBodyLabel(profile.heightCm, profile.weightKg);
  }

  onTeamSearchInput(event: CustomEvent): void {
    const value = (event.detail.value as string | null | undefined) ?? '';
    this.teamQuery = value;
    void this.runTeamSearch(value);
  }

  onTeamSearchClear(): void {
    this.teamQuery = '';
    this.teamRows = [];
    this.searched = false;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  onTeamKindChange(kind: TeamDirectoryKind): void {
    if (this.teamKind === kind) return;
    this.teamKind = kind;
    if (this.teamQuery.trim()) {
      void this.runTeamSearch(this.teamQuery);
    } else {
      this.cdr.markForCheck();
    }
  }

  retrySearch(): void {
    this.errorMessage = '';
    if (this.segment === 'eventos') {
      void this.runEventSearch(this.eventQuery);
      return;
    }
    if (this.segment === 'times') {
      void this.runTeamSearch(this.teamQuery);
      return;
    }
    void this.runProfileSearch(this.profileQuery);
  }

  async toggleTeamHistory(row: TeamSearchRow): Promise<void> {
    if (row.expanded) {
      row.expanded = false;
      this.cdr.markForCheck();
      return;
    }
    row.expanded = true;
    if (row.history.length || row.loadingHistory) {
      this.cdr.markForCheck();
      return;
    }
    row.loadingHistory = true;
    this.cdr.markForCheck();
    try {
      row.history = await this.teamService.listMatchHistory(row.team.id, 8);
    } catch {
      row.history = [];
    } finally {
      row.loadingHistory = false;
      this.cdr.markForCheck();
    }
  }

  openTeamProfile(team: TeamPickerRow): void {
    if (team.kind === 'legend') {
      void this.router.navigate(['/legends/team', team.id]);
      return;
    }
    void this.router.navigate(['/team', team.id]);
  }

  openTeamMatch(eventId: string): void {
    void this.router.navigate(['/event', eventId]);
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

  private async runEventSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    const neighborhood = this.eventNeighborhood.trim();
    if (!trimmed && !neighborhood) {
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
        neighborhood: neighborhood || undefined,
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
        error instanceof Error ? error.message : this.i18n.t('search.error.events');
    } finally {
      if (seq === this.eventSearchSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async runTeamSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.teamRows = [];
      this.searched = false;
      this.loading = false;
      this.errorMessage = '';
      this.cdr.markForCheck();
      return;
    }

    const seq = ++this.teamSearchSeq;
    this.loading = true;
    this.searched = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      if (isParseObjectId(trimmed)) {
        if (this.teamKind === 'legend') {
          const team = await this.legendService.getTeam(trimmed);
          this.teamRows = team
            ? [
                {
                  team: {
                    id: team.id,
                    name: team.apelido || team.name,
                    imageUrl: team.imageUrl,
                    averageAge: null,
                    kind: 'legend' as const,
                    subtitle: team.name,
                  },
                  expanded: false,
                  loadingHistory: false,
                  history: [],
                },
              ]
            : [];
        } else {
          const profile = await this.teamService.getPublicProfile(trimmed);
          this.teamRows = profile
            ? [
                {
                  team: {
                    id: trimmed,
                    name: String(profile['name'] || 'Time'),
                    imageUrl: profile['shieldImageUrl'] as string | undefined,
                    averageAge: (profile['averageAge'] as number | null) ?? null,
                    kind: 'active' as const,
                  },
                  expanded: false,
                  loadingHistory: false,
                  history: [],
                },
              ]
            : [];
        }
        return;
      }

      const results = await this.legendService.searchDirectoryTeamsForPicker(
        this.teamKind,
        trimmed,
        loggedUserAddress()
      );
      if (seq !== this.teamSearchSeq) return;
      this.teamRows = results.map((row) => ({
        team: {
          id: row.id,
          name: row.name,
          imageUrl: row.imageUrl,
          averageAge: row.averageAge ?? null,
          kind: row.kind,
          subtitle: row.subtitle,
        },
        expanded: false,
        loadingHistory: false,
        history: [],
      }));
    } catch (error: unknown) {
      if (seq !== this.teamSearchSeq) return;
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.teamRows = [];
      this.errorMessage =
        error instanceof Error ? error.message : this.i18n.t('search.error.teams');
    } finally {
      if (seq === this.teamSearchSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async runProfileSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    const position =
      this.selectedProfileKind === 'athlete' ? this.selectedAthletePosition.trim() : '';
    if (!trimmed && !position) {
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
        if (isParseObjectId(trimmed)) {
          const one = await this.legendService.getAthlete(trimmed);
          this.legendAthleteResults = one ? [one] : [];
        } else {
          const results = await this.legendService.listAthletes(trimmed);
          if (seq !== this.profileSearchSeq) return;
          this.legendAthleteResults = results;
        }
        if (seq !== this.profileSearchSeq) return;
        this.legendTeamResults = [];
        this.profileResults = [];
      } else if (this.selectedProfileKind === 'legend_team') {
        if (isParseObjectId(trimmed)) {
          const one = await this.legendService.getTeam(trimmed);
          this.legendTeamResults = one ? [one] : [];
        } else {
          const results = await this.legendService.listTeams(trimmed);
          if (seq !== this.profileSearchSeq) return;
          this.legendTeamResults = results;
        }
        if (seq !== this.profileSearchSeq) return;
        this.legendAthleteResults = [];
        this.profileResults = [];
      } else {
        const results = await this.profileSearchService.search(this.selectedProfileKind, trimmed, {
          primaryPosition: position || undefined,
          address: loggedUserAddress(),
        });
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
        error instanceof Error ? error.message : this.i18n.t('search.error.profiles');
    } finally {
      if (seq === this.profileSearchSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private toEventSearchRow(event: PeladaEvent): EventSearchRow {
    let scoreLabel: string | undefined;
    if (event.type === 'team_match') {
      const home =
        event.homeTeamName?.trim() || this.i18n.t('eventDetail.teamMatch.sideHomeFallback');
      const away =
        event.awayTeamName?.trim() || this.i18n.t('eventDetail.teamMatch.sideAwayFallback');
      scoreLabel = `${home} x ${away}`;
    }
    const peladaName = event.peladaName?.trim() || '';
    return {
      event,
      title: peladaName || event.name,
      eventNameLine: peladaName ? event.name : undefined,
      typeLabel: this.eventService.formatType(event.type),
      dateLabel: formatAppDateTime(event.startTime, this.i18n.locale),
      locationLabel: [event.address.city, event.address.state].filter(Boolean).join(' - '),
      scoreLabel,
    };
  }
}

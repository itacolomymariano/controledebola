import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Address } from '../../core/models/address.model';
import { PROFILE_ROLE_LABELS, PROFILE_ROLE_SEARCH_ALIASES } from '../../core/models/profile-role.model';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';
import {
  HomeDirectoryService,
  HomeDirectoryUser,
  HomeTeamBrief,
} from '../../core/services/home-directory.service';
import { I18nService } from '../../core/services/i18n.service';
import { ParseService } from '../../core/services/parse.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import {
  addressFromParts,
  compareDirectoryProximity,
  dateSearchTokens,
  directoryTextMatches,
  formatPlaceLine,
  positionSearchTokens,
  formatPlaceLineWithExtra,
  loggedUserAddress,
} from './home-directory.util';

type HomeDoor = 'confrontos' | 'times' | 'usuarios';

interface MatchRow {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homePresident: string;
  awayPresident: string;
  place: string;
  when: string;
  startTime: Date;
  address: Address;
  sortName: string;
}

interface TeamRow {
  id: string;
  name: string;
  presidentName: string;
  place: string;
  address: Address;
}

interface UserRow {
  user: HomeDirectoryUser;
  rolesLabel: string;
  place: string;
  address: Address;
}

@Component({
  selector: 'app-home-directory',
  templateUrl: './home-directory.page.html',
  styleUrls: ['./home-directory.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HomeDirectoryPage implements OnDestroy {
  door: HomeDoor = 'confrontos';
  search = '';
  loading = true;
  errorMessage = '';
  parseConfigured = false;
  matchRows: MatchRow[] = [];
  teamRows: TeamRow[] = [];
  userRows: UserRow[] = [];
  wizardTeamJoin = false;
  private loadSeq = 0;
  private localeSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly parseService: ParseService,
    private readonly eventService: EventService,
    private readonly directory: HomeDirectoryService,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    const next = this.route.snapshot.data['door'] as HomeDoor;
    if (next !== this.door) {
      this.search = '';
      this.matchRows = [];
      this.teamRows = [];
      this.userRows = [];
    }
    this.door = next;
    this.wizardTeamJoin =
      this.door === 'times' && this.route.snapshot.queryParamMap.get('wizard') === 'teamJoin';
    this.parseConfigured = this.parseService.isConfigured;
    void this.load();
    this.cdr.markForCheck();
  }

  get titleKey(): string {
    if (this.door === 'times') return 'peladas.teamsTitle';
    if (this.door === 'usuarios') return 'peladas.usersTitle';
    return 'peladas.matchesTitle';
  }

  get emptyKey(): string {
    if (this.door === 'times') return 'peladas.teamsEmpty';
    if (this.door === 'usuarios') return 'peladas.usersEmpty';
    return 'peladas.matchesEmpty';
  }

  get visibleMatches(): MatchRow[] {
    return this.matchRows.filter((row) =>
      directoryTextMatches(this.search, [
        row.homeTeamName,
        row.awayTeamName,
        row.homePresident,
        row.awayPresident,
        row.place,
        row.when,
        dateSearchTokens(row.startTime),
      ])
    );
  }

  get visibleTeams(): TeamRow[] {
    return this.teamRows.filter((row) =>
      directoryTextMatches(this.search, [row.name, row.presidentName, row.place])
    );
  }

  get visibleUsers(): UserRow[] {
    return this.userRows.filter((row) =>
      directoryTextMatches(this.search, [
        row.user.fullName,
        row.user.apelido,
        row.user.displayName,
        row.rolesLabel,
        row.user.roles.flatMap((role) => PROFILE_ROLE_SEARCH_ALIASES[role]).join(' '),
        positionSearchTokens(row.user.positions).join(' '),
        row.place,
      ])
    );
  }

  get hasRows(): boolean {
    if (this.door === 'times') return this.teamRows.length > 0;
    if (this.door === 'usuarios') return this.userRows.length > 0;
    return this.matchRows.length > 0;
  }

  get hasVisible(): boolean {
    if (this.door === 'times') return this.visibleTeams.length > 0;
    if (this.door === 'usuarios') return this.visibleUsers.length > 0;
    return this.visibleMatches.length > 0;
  }

  onSearchChange(value: string | null | undefined): void {
    this.search = value ?? '';
    this.cdr.markForCheck();
  }

  goHub(): void {
    void this.router.navigateByUrl('/tabs/peladas');
  }

  openMatch(row: MatchRow): void {
    void this.router.navigate(['/event', row.id]);
  }

  openTeam(row: TeamRow): void {
    void this.router.navigate(['/team', row.id]);
  }

  createTeam(): void {
    void this.router.navigateByUrl('/team-form');
  }

  openUser(row: UserRow): void {
    void this.router.navigate(['/tabs/peladas/usuarios', row.user.userId]);
  }

  retry(): void {
    void this.load();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    event.target.complete();
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    const door = this.door;

    if (!this.parseConfigured) {
      this.loading = false;
      this.errorMessage = 'Configure as chaves do Back4App em environment.local.ts';
      this.cdr.markForCheck();
      return;
    }

    const currentCount =
      door === 'times' ? this.teamRows.length : door === 'usuarios' ? this.userRows.length : this.matchRows.length;
    if (currentCount === 0) this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      if (door === 'times') await this.loadTeams();
      else if (door === 'usuarios') await this.loadUsers();
      else await this.loadMatches();
      if (seq !== this.loadSeq) return;
    } catch (error: unknown) {
      if (seq !== this.loadSeq) return;
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      const fallback =
        door === 'times'
          ? 'peladas.teamsLoadError'
          : door === 'usuarios'
            ? 'peladas.usersLoadError'
            : 'peladas.matchesLoadError';
      this.errorMessage = parseErrorMessage(error) || this.i18n.t(fallback);
    } finally {
      if (seq === this.loadSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async loadMatches(): Promise<void> {
    const matches = await this.eventService.listTeamMatchesForFeed();
    const ids = matches.flatMap((match) =>
      [match.homeTeamId, match.awayTeamId].filter((id): id is string => !!id)
    );
    const briefs = await this.directory.teamsByIds(ids);
    const userAddress = loggedUserAddress();
    const rows = matches.map((match) => this.toMatchRow(match, briefs));
    rows.sort((a, b) =>
      compareDirectoryProximity(userAddress, a.address, b.address, a.sortName, b.sortName)
    );
    this.matchRows = rows;
  }

  private toMatchRow(match: {
    objectId: string;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamId?: string;
    awayTeamId?: string;
    locationComplement: string;
    address: Address;
    startTime: Date;
  }, briefs: Map<string, HomeTeamBrief>): MatchRow {
    const home = match.homeTeamId ? briefs.get(match.homeTeamId) : undefined;
    const away = match.awayTeamId ? briefs.get(match.awayTeamId) : undefined;
    return {
      id: match.objectId,
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      homePresident: home?.presidentName || '',
      awayPresident: away?.presidentName || '',
      place: formatPlaceLineWithExtra(match.address, match.locationComplement),
      when: this.formatWhen(match.startTime),
      startTime: match.startTime,
      address: match.address,
      sortName: `${match.homeTeamName} ${match.awayTeamName}`,
    };
  }

  private async loadTeams(): Promise<void> {
    const teams = await this.directory.listTeams();
    const userAddress = loggedUserAddress();
    const rows = teams.map((team) => ({
      id: team.objectId,
      name: team.name,
      presidentName: team.presidentName,
      place: formatPlaceLine(team.address.state, team.address.city, team.address.neighborhood),
      address: team.address,
    }));
    rows.sort((a, b) => compareDirectoryProximity(userAddress, a.address, b.address, a.name, b.name));
    this.teamRows = rows;
  }

  private async loadUsers(): Promise<void> {
    const users = await this.directory.listUsers();
    const userAddress = loggedUserAddress();
    const rows = users.map((user) => ({
      user,
      rolesLabel: user.roles.map((role) => PROFILE_ROLE_LABELS[role]).join(' · '),
      place: formatPlaceLine(user.state, user.city, user.neighborhood),
      address: addressFromParts(user),
    }));
    rows.sort((a, b) =>
      compareDirectoryProximity(
        userAddress,
        a.address,
        b.address,
        a.user.displayName || a.user.fullName || a.user.apelido,
        b.user.displayName || b.user.fullName || b.user.apelido
      )
    );
    this.userRows = rows;
  }

  private formatWhen(date: Date): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}

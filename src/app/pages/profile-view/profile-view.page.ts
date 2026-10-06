import { Location } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ProfileRole, PROFILE_ROLE_LABELS } from '../../core/models/profile-role.model';
import { RolePublicProfile } from '../../core/models/profile-search.model';
import {
  ROLE_HISTORY_MODE,
  ROLE_PROFILE_FIELDS,
  RoleProfileFieldDef,
  isProfessionalRole,
} from '../../core/models/role-profile.model';
import {
  CoachProfileStats,
  FanEngagementSummary,
  MasseurProfileStats,
  PhysicalTrainerProfileStats,
  SupportRoleProfileStats,
} from '../../core/models/support-role-tools.model';
import { TeamMatchRecord } from '../../core/models/athlete-search.model';
import { AthleteSearchService } from '../../core/services/athlete-search.service';
import { ProfileSearchService } from '../../core/services/profile-search.service';
import { SupportRoleToolsService } from '../../core/services/support-role-tools.service';
import {
  buildProfileReturnUrl,
  navigateToProfileReturn,
  peekProfileReturnNavigationState,
  readProfileReturnNavigationState,
} from '../../core/utils/profile-return-navigation.util';

@Component({
  selector: 'app-profile-view',
  templateUrl: './profile-view.page.html',
  styleUrls: ['./profile-view.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ProfileViewPage implements OnDestroy {
  loading = true;
  profile: RolePublicProfile | null = null;
  errorMessage = '';
  role: ProfileRole | null = null;
  roleLabel = '';
  historyMode = 'none';
  displayFields: RoleProfileFieldDef[] = [];
  operationStats: SupportRoleProfileStats | null = null;
  coachTeamMatchRecord: TeamMatchRecord | null = null;

  /** Rota de onde a ficha foi aberta (busca ou lista de usuarios). */
  private backUrl = '/tabs/search';
  private navSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly location: Location,
    private readonly athleteSearchService: AthleteSearchService,
    private readonly profileSearchService: ProfileSearchService,
    private readonly supportTools: SupportRoleToolsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.navSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe((event) => {
        const next = (event as NavigationStart).url.split('?')[0];
        if (!next.startsWith('/profile/')) return;
        const current = this.router.url.split('?')[0];
        if (current && !current.startsWith('/profile/')) {
          this.backUrl = current;
        }
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  goBack(): void {
    const returnState =
      peekProfileReturnNavigationState() ?? readProfileReturnNavigationState();
    const hiringUrl = returnState?.hiringRole ? buildProfileReturnUrl(returnState) : '';
    if (hiringUrl && !this.isProfilePath(hiringUrl)) {
      navigateToProfileReturn(this.router, returnState!);
      return;
    }

    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.safeBackUrl());
  }

  formatScore(value: number | null | undefined): string {
    const score = Number(value);
    if (!Number.isFinite(score)) return '0.0';
    return score.toFixed(1);
  }

  get showsPeladaHistory(): boolean {
    return this.historyMode === 'pelada_match' || this.historyMode === 'pelada_teams';
  }

  get showsMatchHistory(): boolean {
    return this.historyMode === 'pelada_match';
  }

  get showsTeamHistory(): boolean {
    return this.historyMode === 'teams_only' || this.historyMode === 'pelada_teams';
  }

  get fanStats(): FanEngagementSummary | null {
    return this.supportTools.asFanStats(this.operationStats);
  }

  get coachStats(): CoachProfileStats | null {
    return this.supportTools.asCoachStats(this.operationStats);
  }

  get masseurStats(): MasseurProfileStats | null {
    return this.supportTools.asMasseurStats(this.operationStats);
  }

  get trainerStats(): PhysicalTrainerProfileStats | null {
    return this.supportTools.asTrainerStats(this.operationStats);
  }

  ionViewWillEnter(): void {
    this.rememberBackUrl();
    const roleParam = this.route.snapshot.paramMap.get('role') as ProfileRole | null;
    const userId = this.route.snapshot.paramMap.get('userId') ?? '';
    void this.load(roleParam, userId);
  }

  formatMoney(value?: number): string {
    if (value == null || Number.isNaN(value)) return 'Nao informado';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  fieldValue(field: RoleProfileFieldDef): string {
    const profile = this.profile?.roleProfile;
    if (!profile) return 'Nao informado';
    const value = profile[field.key as keyof typeof profile];
    if (value === undefined || value === null || value === '') return 'Nao informado';
    if (field.type === 'boolean') return value ? 'Sim' : 'Nao';
    if (field.type === 'money' && typeof value === 'number') return this.formatMoney(value);
    return String(value);
  }

  private async load(role: ProfileRole | null, userId: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.role = role;
    this.roleLabel = role ? PROFILE_ROLE_LABELS[role] : '';
    this.historyMode = role && isProfessionalRole(role) ? ROLE_HISTORY_MODE[role] : role === 'fan' ? 'pelada_match' : 'none';
    this.displayFields =
      role && isProfessionalRole(role) ? ROLE_PROFILE_FIELDS[role].filter((field) => field.type !== 'pix') : [];
    this.operationStats = null;
    this.coachTeamMatchRecord = null;

    try {
      if (!role || !userId) {
        this.profile = null;
        this.errorMessage = 'Perfil nao encontrado.';
        return;
      }
      this.profile = await this.profileSearchService.getPublicProfile(role, userId);
      if (!this.profile) {
        this.errorMessage = 'Perfil nao encontrado.';
        return;
      }
      if (
        role === 'fan' ||
        role === 'coach' ||
        role === 'masseur' ||
        role === 'physical_trainer'
      ) {
        this.operationStats = await this.supportTools.getProfileStats(role, userId);
      }
      if (role === 'coach') {
        this.coachTeamMatchRecord = await this.athleteSearchService.getUserTeamMatchRecord(
          userId,
          'coach'
        );
      }
    } catch (error: unknown) {
      this.profile = null;
      this.errorMessage =
        error instanceof Error ? error.message : 'Erro ao carregar perfil.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private rememberBackUrl(): void {
    const prev =
      this.router.lastSuccessfulNavigation?.previousNavigation?.finalUrl?.toString() || '';
    const path = prev.split('?')[0];
    if (path && !this.isProfilePath(path)) {
      this.backUrl = path;
    }
  }

  private safeBackUrl(): string {
    return this.isProfilePath(this.backUrl) ? '/tabs/search' : this.backUrl;
  }

  private isProfilePath(url: string): boolean {
    const path = url.split('?')[0];
    return path === '/profile' || path.startsWith('/profile/');
  }
}

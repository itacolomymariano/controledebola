import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { ProfileSearchService } from '../../core/services/profile-search.service';
import { SupportRoleToolsService } from '../../core/services/support-role-tools.service';
import {
  navigateToProfileReturn,
  peekProfileReturnNavigationState,
  readProfileReturnNavigationState,
} from '../../core/utils/profile-return-navigation.util';

@Component({
  selector: 'app-profile-view',
  templateUrl: './profile-view.page.html',
  styleUrls: ['./profile-view.page.scss'],
  standalone: false,
})
export class ProfileViewPage {
  loading = true;
  profile: RolePublicProfile | null = null;
  errorMessage = '';
  role: ProfileRole | null = null;
  roleLabel = '';
  historyMode = 'none';
  displayFields: RoleProfileFieldDef[] = [];
  operationStats: SupportRoleProfileStats | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly profileSearchService: ProfileSearchService,
    private readonly supportTools: SupportRoleToolsService
  ) {}

  goBack(): void {
    const returnState =
      peekProfileReturnNavigationState() ?? readProfileReturnNavigationState();
    if (returnState?.hiringRole) {
      navigateToProfileReturn(this.router, returnState);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void this.router.navigateByUrl('/tabs/search');
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
    this.role = role;
    this.roleLabel = role ? PROFILE_ROLE_LABELS[role] : '';
    this.historyMode = role && isProfessionalRole(role) ? ROLE_HISTORY_MODE[role] : role === 'fan' ? 'pelada_match' : 'none';
    this.displayFields =
      role && isProfessionalRole(role) ? ROLE_PROFILE_FIELDS[role].filter((field) => field.type !== 'pix') : [];
    this.operationStats = null;

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
    } catch (error: unknown) {
      this.profile = null;
      this.errorMessage =
        error instanceof Error ? error.message : 'Erro ao carregar perfil.';
    } finally {
      this.loading = false;
    }
  }
}

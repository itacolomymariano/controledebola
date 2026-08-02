import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AthletePublicProfile } from '../../core/models/athlete-search.model';
import {
  AthleteScoutPerformanceSummary,
  SCOUT_STAT_GROUPS,
  SCOUT_STAT_LABELS,
} from '../../core/models/scout-apontamento.model';
import { AthleteSearchService } from '../../core/services/athlete-search.service';
import { ScoutApontamentoService } from '../../core/services/scout-apontamento.service';

import { AthletePerformanceDashboard, AthletePerformanceService } from '../../core/services/athlete-performance.service';
import {
  navigateToProfileReturn,
  peekProfileReturnNavigationState,
  readProfileReturnNavigationState,
} from '../../core/utils/profile-return-navigation.util';

type ProfileSegment = 'info' | 'scout' | 'desempenho';

@Component({
  selector: 'app-athlete-profile-view',
  templateUrl: './athlete-profile-view.page.html',
  styleUrls: ['./athlete-profile-view.page.scss'],
  standalone: false,
})
export class AthleteProfileViewPage {
  loading = true;
  profile: AthletePublicProfile | null = null;
  scoutSummary: AthleteScoutPerformanceSummary | null = null;
  performanceDashboard: AthletePerformanceDashboard | null = null;
  scoutLoading = false;
  performanceLoading = false;
  errorMessage = '';
  segment: ProfileSegment = 'info';
  statGroups = SCOUT_STAT_GROUPS;
  statLabels = SCOUT_STAT_LABELS;
  private userId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly athleteSearchService: AthleteSearchService,
    private readonly scoutApontamentoService: ScoutApontamentoService,
    private readonly performanceService: AthletePerformanceService
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

  ionViewWillEnter(): void {
    this.userId = this.route.snapshot.paramMap.get('userId') ?? '';
    void this.load(this.userId);
  }

  onSegmentChange(value: string | number | undefined): void {
    if (value === 'scout') {
      this.segment = 'scout';
      if (!this.scoutSummary && !this.scoutLoading) void this.loadScoutSummary();
      return;
    }
    if (value === 'desempenho') {
      this.segment = 'desempenho';
      if (!this.performanceDashboard && !this.performanceLoading) void this.loadPerformanceDashboard();
      return;
    }
    this.segment = 'info';
  }

  private async loadPerformanceDashboard(): Promise<void> {
    if (!this.userId) return;
    this.performanceLoading = true;
    try {
      this.performanceDashboard = await this.performanceService.loadDashboard('app', undefined, this.userId);
    } finally {
      this.performanceLoading = false;
    }
  }

  get contactPhoneLabel(): string {
    if (!this.profile?.phoneVisible) return 'Restrito pelo atleta';
    return this.formatPhone(this.profile.phone);
  }

  get contactEmailLabel(): string {
    if (!this.profile?.emailVisible) return 'Restrito pelo atleta';
    return this.profile?.email || 'Nao informado';
  }

  formatMoney(value?: number): string {
    if (value == null || Number.isNaN(value)) return 'Nao informado';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  formatPhone(phone?: string): string {
    if (!phone) return 'Nao informado';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      const local = digits.slice(2);
      if (local.length === 11) {
        return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
      }
    }
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  formatEventDate(value?: string): string {
    if (!value) return 'Data nao informada';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  private async load(userId: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.scoutSummary = null;
    try {
      if (!userId) {
        this.profile = null;
        this.errorMessage = 'Atleta nao encontrado.';
        return;
      }
      this.profile = await this.athleteSearchService.getPublicProfile(userId);
      if (!this.profile) {
        this.errorMessage = 'Perfil de atleta nao encontrado.';
      }
    } catch (error: unknown) {
      this.profile = null;
      this.errorMessage =
        error instanceof Error ? error.message : 'Erro ao carregar perfil do atleta.';
    } finally {
      this.loading = false;
    }
  }

  private async loadScoutSummary(): Promise<void> {
    if (!this.userId) return;
    this.scoutLoading = true;
    try {
      this.scoutSummary = await this.scoutApontamentoService.getAthletePerformanceSummary(
        this.userId
      );
    } catch (error: unknown) {
      this.scoutSummary = null;
      this.errorMessage =
        error instanceof Error ? error.message : 'Erro ao carregar desempenho scout.';
    } finally {
      this.scoutLoading = false;
    }
  }
}

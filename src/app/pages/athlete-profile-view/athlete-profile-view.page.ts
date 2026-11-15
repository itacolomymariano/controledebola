import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AthleteActivityIndicators,
  AthletePublicProfile,
  TeamMatchRecord,
} from '../../core/models/athlete-search.model';
import { formatAthleteBodyLabel } from '../../core/models/profile-search.model';
import {
  AthleteScoutPerformanceSummary,
  SCOUT_STAT_GROUPS,
  SCOUT_STAT_LABELS,
} from '../../core/models/scout-apontamento.model';
import { AthleteSearchService } from '../../core/services/athlete-search.service';
import { I18nService } from '../../core/services/i18n.service';
import { ScoutApontamentoService } from '../../core/services/scout-apontamento.service';

import { AthletePerformanceDashboard, AthletePerformanceService } from '../../core/services/athlete-performance.service';
import {
  navigateToProfileReturn,
  peekProfileReturnNavigationState,
  readProfileReturnNavigationState,
} from '../../core/utils/profile-return-navigation.util';
import { playedTeamLinksFromPublicProfile } from '../../core/utils/athlete-played-team.util';

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
  activityIndicators: AthleteActivityIndicators | null = null;
  teamMatchRecord: TeamMatchRecord | null = null;
  presidentTeamMatchRecord: TeamMatchRecord | null = null;
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
    private readonly performanceService: AthletePerformanceService,
    private readonly i18n: I18nService
  ) {}

  get notInformedLabel(): string {
    return this.i18n.t('athleteProfile.notInformed');
  }

  ageLabel(age: number | null | undefined): string {
    if (age == null) return this.i18n.t('athleteProfileView.ageNotInformed');
    return this.i18n.t('eventDetail.teamMatch.yearsOld', { age });
  }

  get playedTeamLinks() {
    if (!this.profile) return [];
    return playedTeamLinksFromPublicProfile(this.profile);
  }

  get teamsReturnUrl(): string {
    return this.router.url;
  }

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

  get bodyMeasureLabel(): string {
    return formatAthleteBodyLabel(this.profile?.heightCm, this.profile?.weightKg);
  }

  get contactPhoneLabel(): string {
    if (!this.profile?.phoneVisible) return this.i18n.t('athleteProfileView.contactRestricted');
    return this.formatPhone(this.profile.phone);
  }

  get contactEmailLabel(): string {
    if (!this.profile?.emailVisible) return this.i18n.t('athleteProfileView.contactRestricted');
    return this.profile?.email || this.notInformedLabel;
  }

  formatMoney(value?: number): string {
    if (value == null || Number.isNaN(value)) return this.notInformedLabel;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  formatPhone(phone?: string): string {
    if (!phone) return this.notInformedLabel;
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
    if (!value) return this.i18n.t('athleteProfileView.dateNotInformed');
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
    this.activityIndicators = null;
    this.teamMatchRecord = null;
    this.presidentTeamMatchRecord = null;
    try {
      if (!userId) {
        this.profile = null;
        this.errorMessage = this.i18n.t('athleteProfileView.athleteNotFound');
        return;
      }
      this.profile = await this.athleteSearchService.getPublicProfile(userId);
      if (!this.profile) {
        this.errorMessage = this.i18n.t('athleteProfileView.profileNotFound');
      } else {
        this.activityIndicators = await this.athleteSearchService.getActivityIndicators(userId, 3);
        this.teamMatchRecord = await this.athleteSearchService.getUserTeamMatchRecord(userId, 'athlete');
        this.presidentTeamMatchRecord =
          await this.athleteSearchService.getPresidentTeamMatchRecord(userId);
      }
    } catch (error: unknown) {
      this.profile = null;
      this.errorMessage =
        error instanceof Error ? error.message : this.i18n.t('athleteProfileView.loadProfileError');
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
        error instanceof Error ? error.message : this.i18n.t('athleteProfileView.loadScoutError');
    } finally {
      this.scoutLoading = false;
    }
  }
}

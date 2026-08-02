import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  ATHLETE_PERSONAL_STATS_CONFLICT_OPTIONS,
  AthletePersonalStatsConflictSource,
  AthleteProfile,
} from '../../core/models/athlete-profile.model';
import {
  EventInviteCandidate,
  formatCandidateRates,
} from '../../core/models/event-hiring.model';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

type HiringSegment = 'trainer' | 'scout';

@Component({
  selector: 'app-athlete-profile-hiring',
  templateUrl: './athlete-profile-hiring.page.html',
  styleUrls: ['./athlete-profile-hiring.page.scss'],
  standalone: false,
})
export class AthleteProfileHiringPage {
  loading = true;
  saving = false;
  searchLoading = false;
  segment: HiringSegment = 'trainer';
  search = '';
  profile: AthleteProfile | null = null;
  trainerCandidates: EventInviteCandidate[] = [];
  scoutCandidates: EventInviteCandidate[] = [];
  displayedCandidates: EventInviteCandidate[] = [];
  personalTrainerUserId = '';
  personalScoutUserId = '';
  personalStatsConflictSource: AthletePersonalStatsConflictSource = 'personal_scout';

  readonly conflictOptions = ATHLETE_PERSONAL_STATS_CONFLICT_OPTIONS;

  constructor(
    private readonly athleteProfileService: AthleteProfileService,
    private readonly roleProfileService: RoleProfileService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  get selectedUserId(): string {
    return this.segment === 'trainer' ? this.personalTrainerUserId : this.personalScoutUserId;
  }

  get selectedCandidate(): EventInviteCandidate | undefined {
    const userId = this.selectedUserId;
    if (!userId) return undefined;
    return this.findCandidate(userId);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  formatCandidateSubtitle(candidate: EventInviteCandidate): string {
    const role = this.segment === 'trainer' ? 'physical_trainer' : 'scout';
    const location = [candidate.city, candidate.state].filter(Boolean).join(' - ');
    const rates = formatCandidateRates(role, candidate, (value) => this.formatCurrency(value));
    return [location, rates.replace(/^ · /, '')].filter(Boolean).join(' · ');
  }

  onSegmentChange(event: CustomEvent): void {
    this.segment = event.detail.value as HiringSegment;
    this.search = '';
    void this.applySearch();
  }

  onSearchInput(event: CustomEvent): void {
    this.search = String(event.detail.value ?? '');
    void this.applySearch();
  }

  onSearchClear(): void {
    this.search = '';
    void this.applySearch();
  }

  selectCandidate(candidate: EventInviteCandidate): void {
    if (this.segment === 'trainer') {
      this.personalTrainerUserId = candidate.userId;
    } else {
      this.personalScoutUserId = candidate.userId;
    }
  }

  clearSelection(): void {
    if (this.segment === 'trainer') {
      this.personalTrainerUserId = '';
    } else {
      this.personalScoutUserId = '';
    }
  }

  viewProfile(candidate: EventInviteCandidate, event: Event): void {
    event.stopPropagation();
    const role = this.segment === 'trainer' ? 'physical_trainer' : 'scout';
    void this.router.navigate(['/profile', role, candidate.userId]);
  }

  async save(): Promise<void> {
    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Salvando...' });
    await loading.present();

    try {
      await this.athleteProfileService.update({
        personalTrainerUserId: this.personalTrainerUserId || undefined,
        personalScoutUserId: this.personalScoutUserId || undefined,
        personalStatsConflictSource: this.personalScoutUserId
          ? this.personalStatsConflictSource
          : undefined,
      });
    } catch (error: unknown) {
      this.saving = false;
      await loading.dismiss();
      await this.showError(parseErrorMessage(error));
      return;
    }

    this.saving = false;
    await loading.dismiss();

    const alert = await this.alertCtrl.create({
      header: 'Salvo',
      message: 'Preferencias de contratacao atualizadas.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.profile = await this.athleteProfileService.getForCurrentUser();
      if (!this.profile) {
        await this.showError('Cadastre seu perfil de atleta antes de contratar profissionais.');
        void this.router.navigateByUrl('/athlete-profile/form');
        return;
      }

      this.personalTrainerUserId = this.profile.personalTrainerUserId ?? '';
      this.personalScoutUserId = this.profile.personalScoutUserId ?? '';
      this.personalStatsConflictSource =
        this.profile.personalStatsConflictSource ?? 'personal_scout';

      const [trainers, scouts] = await Promise.all([
        this.roleProfileService.listRoleCandidates('physical_trainer'),
        this.roleProfileService.listRoleCandidates('scout'),
      ]);
      this.trainerCandidates = trainers;
      this.scoutCandidates = scouts;
      await this.applySearch();
    } finally {
      this.loading = false;
    }
  }

  private async applySearch(): Promise<void> {
    const query = this.search.trim();
    if (!query) {
      this.displayedCandidates = [];
      return;
    }

    this.displayedCandidates = this.filterLocally(query);
    if (query.length < 2) return;

    this.searchLoading = true;
    try {
      const serverMatches =
        this.segment === 'trainer'
          ? await this.roleProfileService.searchRoleCandidates('physical_trainer', query)
          : await this.roleProfileService.searchRoleCandidates('scout', query);
      if (serverMatches.length) {
        this.displayedCandidates = serverMatches;
        this.mergeCache(serverMatches);
      }
    } finally {
      this.searchLoading = false;
    }
  }

  private filterLocally(query: string): EventInviteCandidate[] {
    const role = this.segment === 'trainer' ? 'physical_trainer' : 'scout';
    const pool = this.segment === 'trainer' ? this.trainerCandidates : this.scoutCandidates;
    return this.roleProfileService.filterRoleCandidates(pool, query, role);
  }

  private mergeCache(matches: EventInviteCandidate[]): void {
    const target =
      this.segment === 'trainer' ? this.trainerCandidates : this.scoutCandidates;
    const byUserId = new Map(target.map((item) => [item.userId, item]));
    for (const match of matches) {
      byUserId.set(match.userId, match);
    }
    const merged = Array.from(byUserId.values()).sort((a, b) =>
      (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
    );
    if (this.segment === 'trainer') {
      this.trainerCandidates = merged;
    } else {
      this.scoutCandidates = merged;
    }
  }

  private findCandidate(userId: string): EventInviteCandidate | undefined {
    const pool = this.segment === 'trainer' ? this.trainerCandidates : this.scoutCandidates;
    return (
      pool.find((item) => item.userId === userId) ??
      this.displayedCandidates.find((item) => item.userId === userId)
    );
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

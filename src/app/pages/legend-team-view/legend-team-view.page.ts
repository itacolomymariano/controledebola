import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import {
  AmateurLegendTeam,
  LEGEND_TEAM_RELATIONSHIP_OPTIONS,
  LegendTeamAthleteDisplay,
} from '../../core/models/amateur-legend.model';
import { AuthService } from '../../core/services/auth.service';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';
import { LegendTeamJoinRequestService } from '../../core/services/legend-team-join-request.service';
import { I18nService } from '../../core/services/i18n.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-legend-team-view',
  templateUrl: './legend-team-view.page.html',
  styleUrls: ['./legend-team-view.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LegendTeamViewPage {
  loading = true;
  team: AmateurLegendTeam | null = null;
  errorMessage = '';
  joinBusy = false;
  pendingJoin = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly legendService: AmateurLegendService,
    private readonly joinService: LegendTeamJoinRequestService,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get canEditLegend(): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    return !!userId && !!this.team?.registeredByUserId && this.team.registeredByUserId === userId;
  }

  get roster(): LegendTeamAthleteDisplay[] {
    if (this.team?.athletes?.length) return this.team.athletes;
    return (this.team?.athleteRefs ?? []).map((ref) => ({
      type: ref.type,
      id: ref.id,
      apelido: ref.label,
      age: null,
      inMemoriam: false,
    }));
  }

  get canRequestJoin(): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    if (!userId || !this.team) return false;
    if (this.team.registeredByUserId === userId) return false;
    if (this.team.presidentUserId === userId) return false;
    if (this.isOnRoster(userId)) return false;
    return !this.pendingJoin;
  }

  editLegend(): void {
    if (!this.team?.id || !this.canEditLegend) return;
    void this.router.navigate(['/legends/team/edit', this.team.id]);
  }

  ionViewWillEnter(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load(id);
  }

  relationshipLabel(value: string | undefined): string {
    return LEGEND_TEAM_RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? '—';
  }

  formatDate(value: string | undefined): string {
    if (!value?.trim()) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  ageLabel(athlete: LegendTeamAthleteDisplay): string {
    if (athlete.inMemoriam) return this.i18n.t('legends.inMemoriam');
    if (athlete.age == null) return '—';
    return this.i18n.t('peladas.ageYears', { age: athlete.age });
  }

  openAthlete(athlete: LegendTeamAthleteDisplay): void {
    if (athlete.type === 'legend_athlete') {
      void this.router.navigate(['/legends/athlete', athlete.id]);
      return;
    }
    void this.router.navigate(['/tabs/peladas/usuarios', athlete.id]);
  }

  async requestJoin(): Promise<void> {
    const teamId = this.team?.id;
    if (!teamId || !this.canRequestJoin) return;
    this.joinBusy = true;
    this.cdr.markForCheck();
    const loading = await this.loadingCtrl.create({ message: 'Enviando...' });
    await loading.present();
    try {
      await this.joinService.request(teamId);
      this.pendingJoin = true;
      const toast = await this.toastCtrl.create({
        message: 'Pedido enviado aos responsaveis pelo time lenda.',
        duration: 2500,
        color: 'success',
      });
      await toast.present();
    } catch (error: unknown) {
      const toast = await this.toastCtrl.create({
        message: parseErrorMessage(error),
        duration: 3500,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.joinBusy = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  private isOnRoster(userId: string): boolean {
    return this.roster.some((row) => row.type === 'app_athlete' && row.id === userId);
  }

  private async refreshJoinState(teamId: string): Promise<void> {
    try {
      const rows = await this.joinService.listMine();
      this.pendingJoin = rows.some(
        (row) => row.legendTeamId === teamId && row.status === 'pending' && row.athleteUserId === this.auth.getCurrentUser()?.id
      );
    } catch {
      this.pendingJoin = false;
    }
  }

  private async load(id: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.team = null;
    this.cdr.markForCheck();
    try {
      if (!id.trim()) {
        this.errorMessage = 'Time lenda nao encontrado.';
        return;
      }
      this.team = await this.legendService.getTeam(id);
      if (!this.team) {
        this.errorMessage = 'Time lenda nao encontrado.';
        return;
      }
      await this.refreshJoinState(id);
    } catch {
      this.errorMessage = 'Nao foi possivel carregar o perfil do time lenda.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}

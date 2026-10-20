import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AmateurTeamJoinRequestService } from '../../core/services/amateur-team-join-request.service';
import { AuthService } from '../../core/services/auth.service';
import { TeamService } from '../../core/services/team.service';
import { WizardTourService } from '../../core/services/wizard-tour.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { formatTeamMatchDate, teamMatchResultName } from '../../core/utils/team-match-result.util';

@Component({
  selector: 'app-team-profile',
  templateUrl: './team-profile.page.html',
  styleUrls: ['./team-profile.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TeamProfilePage {
  loading = true;
  errorMessage = '';
  profile: Record<string, unknown> | null = null;
  joinBusy = false;
  pendingJoin = false;
  wizardTeamJoin = false;
  readonly resultName = teamMatchResultName;
  readonly formatMatchDate = formatTeamMatchDate;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly teamService: TeamService,
    private readonly auth: AuthService,
    private readonly joinService: AmateurTeamJoinRequestService,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
    private readonly wizardTour: WizardTourService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.wizardTeamJoin = this.route.snapshot.queryParamMap.get('wizard') === 'teamJoin';
    const teamId = this.route.snapshot.paramMap.get('id') || '';
    this.loading = true;
    this.errorMessage = '';
    try {
      this.profile = await this.teamService.getPublicProfile(teamId);
      await this.refreshJoinState(teamId);
      await this.maybeDismissWizardTeamJoin();
    } catch (error: unknown) {
      this.errorMessage = parseErrorMessage(error);
      this.profile = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get canRequestJoin(): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    if (!userId || !this.profile) return false;
    const presidentId = String(this.profile['presidentId'] || '');
    if (presidentId && presidentId === userId) return false;
    return !this.pendingJoin;
  }

  async requestJoin(): Promise<void> {
    const teamId = this.route.snapshot.paramMap.get('id') || '';
    if (!teamId || !this.canRequestJoin) return;
    this.joinBusy = true;
    this.cdr.markForCheck();
    const loading = await this.loadingCtrl.create({ message: 'Enviando...' });
    await loading.present();
    try {
      await this.joinService.request(teamId);
      this.pendingJoin = true;
      const toast = await this.toastCtrl.create({
        message: 'Pedido enviado ao presidente do time.',
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

  private async maybeDismissWizardTeamJoin(): Promise<void> {
    if (!this.wizardTeamJoin || !this.profile) return;
    await this.wizardTour.dismissJoinSearchStayOnPage();
    this.wizardTeamJoin = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { wizard: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async refreshJoinState(teamId: string): Promise<void> {
    const userId = this.auth.getCurrentUser()?.id;
    if (!userId) {
      this.pendingJoin = false;
      return;
    }
    try {
      const rows = await this.joinService.listMine();
      this.pendingJoin = rows.some(
        (row) => row.teamId === teamId && row.athleteUserId === userId && row.status === 'pending'
      );
    } catch {
      this.pendingJoin = false;
    }
  }

  goBack(): void {
    void this.router.navigateByUrl('/tabs/peladas/times');
  }

  formatFoundedAt(value: unknown): string {
    const formatted = formatTeamMatchDate(typeof value === 'string' ? value : '');
    return formatted || 'Não informada';
  }

  get lastDefeatText(): string {
    const defeat = this.profile?.['lastDefeat'] as
      | {
          startTime?: string | null;
          homeTeamName?: string;
          awayTeamName?: string;
          homeScore?: number;
          awayScore?: number;
        }
      | null
      | undefined;
    if (defeat) {
      const when = formatTeamMatchDate(defeat.startTime);
      const score = `${defeat.homeTeamName || ''} ${defeat.homeScore ?? 0} x ${defeat.awayScore ?? 0} ${defeat.awayTeamName || ''}`.trim();
      return when ? `${when} — ${score}` : score;
    }
    return this.profile?.['unbeatenFor'] ? 'Nenhuma derrota registrada' : '—';
  }

  gamesLabel(value: unknown): string {
    const games = typeof value === 'number' ? value : 0;
    return games === 1 ? '1 jogo' : `${games} jogos`;
  }

  rateLabel(value: unknown): string {
    return typeof value === 'number' ? `${value}%` : '—';
  }
}

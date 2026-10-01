import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TeamService } from '../../core/services/team.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { formatTeamMatchDate, teamMatchResultName } from '../../core/utils/team-match-result.util';

@Component({
  selector: 'app-team-profile',
  templateUrl: './team-profile.page.html',
  styleUrls: ['./team-profile.page.scss'],
  standalone: false,
})
export class TeamProfilePage {
  loading = true;
  errorMessage = '';
  profile: Record<string, unknown> | null = null;
  readonly resultName = teamMatchResultName;
  readonly formatMatchDate = formatTeamMatchDate;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly teamService: TeamService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    const teamId = this.route.snapshot.paramMap.get('id') || '';
    this.loading = true;
    this.errorMessage = '';
    try {
      this.profile = await this.teamService.getPublicProfile(teamId);
    } catch (error: unknown) {
      this.errorMessage = parseErrorMessage(error);
      this.profile = null;
    } finally {
      this.loading = false;
    }
  }

  goBack(): void {
    void this.router.navigateByUrl('/inbox');
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

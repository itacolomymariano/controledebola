import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import {
  MuralTeamMatchDashboard,
  MuralTeamMatchPerformanceTopEntry,
  MuralTeamMatchRecordHighlight,
} from '../../../core/models/mural.model';
import { MuralRankingEntry } from '../../../core/models/mural.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';

@Component({
  selector: 'app-mural-confrontos-panel',
  templateUrl: './mural-confrontos-panel.component.html',
  styleUrls: ['./mural-confrontos-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralConfrontosPanelComponent {
  @Input() dashboard: MuralTeamMatchDashboard | null = null;
  @Input() loading = false;
  @Input() shareContext: MuralShareContext = { scope: 'app' };

  constructor(private readonly router: Router) {}

  openTeam(teamId: string | undefined): void {
    if (!teamId) return;
    void this.router.navigate(['/team', teamId]);
  }

  teamHighlightLabel(key: string): string {
    const labels: Record<string, string> = {
      mostMatches: 'Mais jogos',
      mostWins: 'Mais vitorias',
      mostLosses: 'Mais derrotas',
      mostDraws: 'Mais empates',
      bestWinRate: 'Melhor aproveitamento',
    };
    return labels[key] || key;
  }

  highlightEntries(): Array<{ key: string; team: MuralTeamMatchRecordHighlight }> {
    if (!this.dashboard?.teamHighlights) return [];
    const highlights = this.dashboard.teamHighlights;
    const keys = ['mostMatches', 'mostWins', 'mostLosses', 'mostDraws', 'bestWinRate'] as const;
    const rows: Array<{ key: string; team: MuralTeamMatchRecordHighlight }> = [];
    for (const key of keys) {
      const team = highlights[key];
      if (team) rows.push({ key, team });
    }
    return rows;
  }

  recordLine(team: MuralTeamMatchRecordHighlight): string {
    return `${team.matchesPlayed} J · ${team.wins} V · ${team.draws} E · ${team.losses} D · ${team.winRatePercent}%`;
  }

  rankingBadge(entry: MuralRankingEntry): string {
    if (entry.voteCount > 0) {
      const avg = Number(entry.averageScore ?? entry.totalScore) || 0;
      return avg.toFixed(1);
    }
    return `${Math.round(entry.combinedScore || entry.totalScore)}`;
  }

  performanceName(entry: MuralTeamMatchPerformanceTopEntry): string {
    return entry.userName || 'Participante';
  }
}

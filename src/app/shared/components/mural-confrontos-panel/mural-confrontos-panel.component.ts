import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  MuralTeamMatchDashboard,
  MuralTeamMatchPerformanceTopEntry,
  MuralTeamMatchRecordHighlight,
} from '../../../core/models/mural.model';
import { MuralRankingEntry } from '../../../core/models/mural.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { I18nService } from '../../../core/services/i18n.service';
import {
  muralPlayfulNestedTone,
  muralPlayfulToneByIndex,
} from '../../../core/utils/mural-playful-tone.util';
import { PlayfulCardTone } from '../playful-card/playful-card.component';

@Component({
  selector: 'app-mural-confrontos-panel',
  templateUrl: './mural-confrontos-panel.component.html',
  styleUrls: ['./mural-confrontos-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralConfrontosPanelComponent implements OnDestroy {
  @Input() dashboard: MuralTeamMatchDashboard | null = null;
  @Input() loading = false;
  @Input() shareContext: MuralShareContext = { scope: 'app' };

  private localeSub?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  openTeam(teamId: string | undefined): void {
    if (!teamId) return;
    void this.router.navigate(['/team', teamId]);
  }

  teamHighlightLabel(key: string): string {
    const labelKeys: Record<string, string> = {
      mostMatches: 'mural.confrontos.highlight.mostMatches',
      mostWins: 'mural.confrontos.highlight.mostWins',
      mostLosses: 'mural.confrontos.highlight.mostLosses',
      mostDraws: 'mural.confrontos.highlight.mostDraws',
      bestWinRate: 'mural.confrontos.highlight.bestWinRate',
    };
    const i18nKey = labelKeys[key];
    return i18nKey ? this.i18n.t(i18nKey) : key;
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
    return this.i18n.t('mural.confrontos.recordLine', {
      played: team.matchesPlayed,
      wins: team.wins,
      draws: team.draws,
      losses: team.losses,
      winRate: team.winRatePercent,
    });
  }

  rankingBadge(entry: MuralRankingEntry): string {
    if (entry.voteCount > 0) {
      const avg = Number(entry.averageScore ?? entry.totalScore) || 0;
      return avg.toFixed(1);
    }
    return `${Math.round(entry.combinedScore || entry.totalScore)}`;
  }

  performanceName(entry: MuralTeamMatchPerformanceTopEntry): string {
    return entry.userName || this.i18n.t('common.participant');
  }

  cardTone(cardIndex: number): PlayfulCardTone {
    return muralPlayfulToneByIndex(cardIndex);
  }

  nestedTone(parent: PlayfulCardTone, childIndex: number): PlayfulCardTone {
    return muralPlayfulNestedTone(parent, childIndex);
  }
}
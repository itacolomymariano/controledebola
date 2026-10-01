import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  highlightTitlesForTab,
  MuralAppSupportRoleSection,
  MuralAppTab,
  supportRoleSectionsForTab,
  tabShowsTeamCoachResults,
} from '../../../core/config/mural-app-sections.config';
import { MuralHighlights } from '../../../core/models/mural-highlights.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import {
  MuralAppBucketPayload,
  MuralAppPredictionEntry,
  MuralRankingEntry,
  MuralTeamMatchBestAttack,
  MuralTeamMatchBestDefense,
  MuralTeamMatchBestTeam,
  MuralTeamMatchDashboard,
  MuralTeamMatchUnbeatenStreak,
} from '../../../core/models/mural.model';
import { MuralLocationTopRankings } from '../../../core/models/mural-location-top.model';
import { MuralParticipantLocationStats } from '../../../core/models/mural-participant-stats.model';
import {
  MuralPerformanceAnalytics,
} from '../../../core/services/athlete-performance.service';
import { muralRankingBadgeLabel, athleteRankingDisplayNote } from '../../../core/utils/mural-ranking.util';

@Component({
  selector: 'app-mural-app-feed',
  templateUrl: './mural-app-feed.component.html',
  styleUrls: ['./mural-app-feed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralAppFeedComponent {
  @Input({ required: true }) tab!: MuralAppTab;
  @Input() bucket: MuralAppBucketPayload | null = null;
  @Input() highlights: MuralHighlights | null = null;
  @Input({ required: true }) shareContext!: MuralShareContext;
  @Input() participantStats: MuralParticipantLocationStats | null = null;
  @Input() locationTopRankings: MuralLocationTopRankings | null = null;
  @Input() performanceAnalytics: MuralPerformanceAnalytics | null = null;
  /** Dashboard de confrontos: alimenta os destaques da aba Confrontos. */
  @Input() teamMatchDashboard: MuralTeamMatchDashboard | null = null;
  @Input() dashboardFromCloud = false;
  /** Frase do filtro de regiao, igual a da legenda de compartilhamento. */
  @Input() filterCaption = '';

  get supportSections(): MuralAppSupportRoleSection[] {
    return supportRoleSectionsForTab(this.tab);
  }

  get isConfrontosTab(): boolean {
    return this.tab === 'confrontos';
  }

  /** Destaques novos: ausentes enquanto o Cloud Code atualizado nao for publicado. */
  get bestTeam(): MuralTeamMatchBestTeam | null {
    return this.isConfrontosTab ? (this.teamMatchDashboard?.bestTeam ?? null) : null;
  }

  get longestUnbeaten(): MuralTeamMatchUnbeatenStreak | null {
    return this.isConfrontosTab ? (this.teamMatchDashboard?.longestUnbeaten ?? null) : null;
  }

  get bestAttack(): MuralTeamMatchBestAttack | null {
    return this.isConfrontosTab ? (this.teamMatchDashboard?.bestAttack ?? null) : null;
  }

  get bestDefense(): MuralTeamMatchBestDefense | null {
    return this.isConfrontosTab ? (this.teamMatchDashboard?.bestDefense ?? null) : null;
  }

  unbeatenText(entry: MuralTeamMatchUnbeatenStreak): string {
    const label = entry.unbeatenLabel?.trim();
    if (label) return label;
    return `${entry.unbeatenDays} dia(s)`;
  }

  formatAverage(value: number): string {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0,00';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get titles() {
    return highlightTitlesForTab(this.tab);
  }

  showTeamCoachBlocks(): boolean {
    return tabShowsTeamCoachResults(this.tab);
  }

  athleteEntries(): MuralRankingEntry[] {
    const entries = this.bucket?.rankings?.athlete ?? [];
    return [...entries].sort((a, b) => {
      const noteDiff = athleteRankingDisplayNote(b) - athleteRankingDisplayNote(a);
      if (noteDiff !== 0) return noteDiff;
      const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
      if (voteDiff !== 0) return voteDiff;
      return (b.combinedScore || 0) - (a.combinedScore || 0);
    });
  }

  supportEntries(role: MuralAppSupportRoleSection['role']): MuralRankingEntry[] {
    return this.bucket?.rankings?.[role] ?? [];
  }

  predictionEntries(): MuralAppPredictionEntry[] {
    return this.bucket?.predictionRankings ?? [];
  }

  badge(role: MuralAppSupportRoleSection['role'], entry: MuralRankingEntry): string {
    return muralRankingBadgeLabel(role, entry);
  }

  teamPointsLabel(entry: {
    wins?: number;
    draws?: number;
    combinedScore?: number;
    totalScore?: number;
  }): string {
    const pts =
      entry.combinedScore ??
      entry.totalScore ??
      Number(entry.wins || 0) * 3 + Number(entry.draws || 0);
    return `${pts} pts`;
  }

  formatFoundedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  }
}

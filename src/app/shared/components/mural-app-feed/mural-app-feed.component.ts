import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  highlightTitleKeysForTab,
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
  MuralLocationFilter,
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
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-mural-app-feed',
  templateUrl: './mural-app-feed.component.html',
  styleUrls: ['./mural-app-feed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralAppFeedComponent {
  constructor(private readonly i18n: I18nService) {}

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
  @Input() locationFilter?: MuralLocationFilter;

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
    return this.i18n.t('common.daysCount', { days: entry.unbeatenDays });
  }

  formatAverage(value: number): string {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0,00';
    const locale = this.i18n.locale === 'en-GB' ? 'en-GB' : this.i18n.locale === 'es-ES' ? 'es-ES' : 'pt-BR';
    return num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get titleKeys() {
    return highlightTitleKeysForTab(this.tab);
  }

  titleText(key: string): string {
    return this.i18n.t(key);
  }

  get highlightTitleOverrides(): { craque: string; goalkeeper: string; scorer: string } {
    const k = this.titleKeys;
    return {
      craque: this.titleText(k.craque),
      goalkeeper: this.titleText(k.goalkeeper),
      scorer: this.titleText(k.scorer),
    };
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
    const locale = this.i18n.locale === 'en-GB' ? 'en-GB' : this.i18n.locale === 'es-ES' ? 'es-ES' : 'pt-BR';
    return d.toLocaleDateString(locale);
  }

  yesNo(value: boolean | undefined): string {
    return this.i18n.t(value ? 'common.yes' : 'common.no');
  }

  ageYears(age: number): string {
    return this.i18n.t('mural.app.coach.ageYears', { age });
  }
}

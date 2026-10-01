import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import {
  ATHLETE_FOOT_LABELS,
  formatFootPreference,
} from '../../../core/models/athlete-performance.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import {
  AthletePerformanceService,
  MuralPerformanceAnalytics,
  MuralPerformanceTopEntry,
  PerformanceScope,
} from '../../../core/services/athlete-performance.service';

@Component({
  selector: 'app-mural-performance-analytics',
  templateUrl: './mural-performance-analytics.component.html',
  styleUrls: ['./mural-performance-analytics.component.scss'],
  standalone: false,
})
export class MuralPerformanceAnalyticsComponent implements OnChanges {
  @Input({ required: true }) scope!: PerformanceScope;
  @Input() scopeId?: string;
  @Input() analytics: MuralPerformanceAnalytics | Record<string, unknown> | null = null;
  @Input() preloadAnalytics = false;
  @Input() shareContext: MuralShareContext | null = null;
  @Input() filterCaption = '';

  loading = false;
  loadedAnalytics: MuralPerformanceAnalytics | null = null;

  constructor(private readonly performanceService: AthletePerformanceService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.preloadAnalytics) {
      const normalized = this.analytics
        ? this.performanceService.normalizeMuralAnalytics(this.analytics)
        : null;
      this.loadedAnalytics =
        normalized?.qualitative && normalized?.charts ? normalized : null;
      this.loading = false;
      return;
    }
    if (!changes['scope'] && !changes['scopeId'] && !changes['preloadAnalytics']) {
      return;
    }
    void this.load();
  }

  displayName(entry: MuralPerformanceTopEntry): string {
    return entry.apelido || entry.userName || entry.userId;
  }

  formatFoot(entry: MuralPerformanceTopEntry): string {
    if (!entry.footPreference) return '—';
    return formatFootPreference(entry.footPreference) || ATHLETE_FOOT_LABELS[entry.footPreference] || '—';
  }

  barWidth(value: number, max: number): string {
    if (!max) return '0%';
    return `${Math.max(4, Math.round((value / max) * 100))}%`;
  }

  chartMax(): number {
    if (!this.loadedAnalytics) return 1;
    const c = this.loadedAnalytics?.charts;
    if (!c) return 1;
    return Math.max(c.shotsOnTarget, c.shotsOffTarget, c.goals, c.totalShots, 1);
  }

  foulChartMax(): number {
    if (!this.loadedAnalytics) return 1;
    const c = this.loadedAnalytics?.charts;
    if (!c) return 1;
    return Math.max(c.foulsCommitted, c.athleteCount, 1);
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const analytics = await this.performanceService.loadMuralAnalytics(this.scope, this.scopeId);
      this.loadedAnalytics =
        analytics?.qualitative && analytics?.charts ? analytics : null;
    } catch {
      this.loadedAnalytics = null;
    } finally {
      this.loading = false;
    }
  }
}

import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { muralLocationFiltersEqual } from '../../../core/utils/mural-location-filter.util';
import { MuralAppTab } from '../../../core/config/mural-app-sections.config';
import { MuralLocationFilter } from '../../../core/models/mural.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import {
  MuralPeriodSpotlightEntry,
  MuralPeriodSpotlightKey,
  MuralService,
} from '../../../core/services/mural.service';

export type MuralPeriodRankMetric = 'goals' | 'yellowCards' | 'redCards';

@Component({
  selector: 'app-mural-period-rankings-card',
  templateUrl: './mural-period-rankings-card.component.html',
  styleUrls: ['./mural-period-rankings-card.component.scss'],
  standalone: false,
})
export class MuralPeriodRankingsCardComponent implements OnInit, OnChanges {
  @Input() mode: 'spotlights' | 'legacy' = 'spotlights';
  @Input() scope: 'app' | 'pelada' = 'app';
  @Input() scopeId = '';
  @Input() filterCaption = '';
  @Input() locationFilter?: MuralLocationFilter;
  @Input() appBucketTab: MuralAppTab = 'geral';
  @Input() shareContext: MuralShareContext | null = null;

  periodFilter: 'week' | 'month' | 'year' = 'week';
  periodMetric: MuralPeriodRankMetric | MuralPeriodSpotlightKey = 'craque';
  periodRankings: Array<{ userId: string; userName: string; avatarUrl?: string; value: number }> = [];
  periodRankingsLoading = false;

  spotlights: Partial<Record<MuralPeriodSpotlightKey, MuralPeriodSpotlightEntry>> = {};
  periodShareLabel = '';

  readonly spotlightRow1: MuralPeriodSpotlightKey[] = ['craque', 'goleador', 'melhorGoleiro'];
  readonly spotlightRow2: MuralPeriodSpotlightKey[] = ['melhorJuiz', 'yellowCards', 'redCards'];

  constructor(
    private readonly muralService: MuralService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.mode === 'legacy') {
      this.periodMetric = 'goals';
    }
    void this.reload();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const filterChange = changes['locationFilter'];
    const filterChanged =
      !!filterChange &&
      !filterChange.firstChange &&
      !muralLocationFiltersEqual(
        filterChange.previousValue as MuralLocationFilter | undefined,
        filterChange.currentValue as MuralLocationFilter | undefined
      );
    const tabChange = changes['appBucketTab'];
    const tabChanged = !!tabChange && !tabChange.firstChange;
    if (filterChanged || tabChanged) {
      void this.reload();
    }
  }

  get isLegacyPelada(): boolean {
    return this.mode === 'legacy' && this.scope === 'pelada';
  }

  get activeSpotlight(): MuralPeriodSpotlightEntry | null {
    if (this.isLegacyPelada) return null;
    const key = this.periodMetric as MuralPeriodSpotlightKey;
    return this.spotlights[key] ?? null;
  }

  get periodSelectionCaption(): string {
    if (this.periodShareLabel) return this.periodShareLabel;
    const periodLabels: Record<string, string> = {
      week: 'Semana',
      month: 'Mês',
      year: 'Ano',
    };
    return `Período: ${periodLabels[this.periodFilter] || ''}`;
  }

  get activeCardTitle(): string {
    const labels: Record<MuralPeriodSpotlightKey, string> = {
      craque: 'Craque',
      goleador: 'Goleador',
      melhorGoleiro: 'Melhor goleiro',
      melhorJuiz: 'Melhor juiz',
      yellowCards: 'Cartões amarelos',
      redCards: 'Cartões vermelhos',
    };
    if (this.isLegacyPelada) {
      const legacy: Record<MuralPeriodRankMetric, string> = {
        goals: 'Gols',
        yellowCards: 'Cartões amarelos',
        redCards: 'Cartões vermelhos',
      };
      return legacy[this.periodMetric as MuralPeriodRankMetric] || 'Gols';
    }
    return `${labels[this.periodMetric as MuralPeriodSpotlightKey] || 'Resultado'} — Resultados por período`;
  }

  get activeRuleKey(): string {
    if (this.isLegacyPelada) {
      if (this.periodMetric === 'goals') return 'mural.rule.goleador';
      return 'mural.rule.period.amarelos';
    }
    return `mural.rule.period.${this.periodMetric}`;
  }

  get shareContextForCard(): MuralShareContext | null {
    if (!this.shareContext) return null;
    return {
      ...this.shareContext,
      cardTitle: this.activeCardTitle,
      periodShareLabel: this.periodShareLabel || undefined,
    };
  }

  metricLabel(key: MuralPeriodSpotlightKey): string {
    const labels: Record<MuralPeriodSpotlightKey, string> = {
      craque: 'CRAQUE',
      goleador: 'GOLEADOR',
      melhorGoleiro: 'MELHOR GOLEIRO',
      melhorJuiz: 'MELHOR JUIZ',
      yellowCards: 'AMARELOS',
      redCards: 'VERMELHOS',
    };
    return labels[key];
  }

  async onPeriodFilterChange(value: 'week' | 'month' | 'year'): Promise<void> {
    this.periodFilter = value;
    await this.reload();
  }

  async onPeriodMetricChange(value: MuralPeriodSpotlightKey | MuralPeriodRankMetric): Promise<void> {
    this.periodMetric = value;
    if (this.isLegacyPelada) {
      await this.loadLegacyRankings();
    } else {
      this.cdr.markForCheck();
    }
  }

  private async reload(): Promise<void> {
    if (this.isLegacyPelada) {
      await this.loadLegacyRankings();
      return;
    }
    await this.loadSpotlights();
  }

  private async loadSpotlights(): Promise<void> {
    this.periodRankingsLoading = true;
    this.cdr.markForCheck();
    try {
      const payload = await this.muralService.getPeriodSpotlights(
        this.periodFilter,
        this.locationFilter,
        this.appBucketTab
      );
      this.spotlights = payload.winners;
      this.periodShareLabel = payload.periodShareLabel;
      if (!this.spotlightRow1.includes(this.periodMetric as MuralPeriodSpotlightKey) &&
          !this.spotlightRow2.includes(this.periodMetric as MuralPeriodSpotlightKey)) {
        this.periodMetric = 'craque';
      }
    } finally {
      this.periodRankingsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadLegacyRankings(): Promise<void> {
    this.periodRankingsLoading = true;
    this.cdr.markForCheck();
    try {
      const metric = this.periodMetric as MuralPeriodRankMetric;
      const scopeId = this.scope === 'pelada' ? this.scopeId || undefined : undefined;
      this.periodRankings = await this.muralService.getPeriodRankings(
        'pelada',
        scopeId,
        this.periodFilter,
        metric,
        10
      );
    } finally {
      this.periodRankingsLoading = false;
      this.cdr.markForCheck();
    }
  }
}

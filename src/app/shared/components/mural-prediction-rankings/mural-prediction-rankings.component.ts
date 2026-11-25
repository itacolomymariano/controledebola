import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { PredictionRankingEntry } from '../../../core/models/fan-prediction.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralScope } from '../../../core/models/mural.model';
import { FanPredictionService } from '../../../core/services/fan-prediction.service';
import { I18nService } from '../../../core/services/i18n.service';
import { muralPlayfulNestedTone } from '../../../core/utils/mural-playful-tone.util';
import { PlayfulCardTone } from '../playful-card/playful-card.component';

@Component({
  selector: 'app-mural-prediction-rankings',
  templateUrl: './mural-prediction-rankings.component.html',
  styleUrls: ['./mural-prediction-rankings.component.scss'],
  standalone: false,
})
export class MuralPredictionRankingsComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) scope!: MuralScope;
  @Input() scopeId?: string;
  @Input() entries: PredictionRankingEntry[] = [];
  @Input() preloadEntries = false;
  @Input() shareContext: MuralShareContext | null = null;
  @Input() playfulChrome = false;

  loading = false;
  loadedEntries: PredictionRankingEntry[] = [];
  private localeSub?: Subscription;

  readonly predictionParentTone: PlayfulCardTone = 'confrontos';

  predictionNestedTone(childIndex: number): PlayfulCardTone {
    return muralPlayfulNestedTone(this.predictionParentTone, childIndex);
  }

  constructor(
    private readonly fanPredictionService: FanPredictionService,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  get emptyMessage(): string {
    return this.scope === 'event'
      ? this.i18n.t('mural.predictions.empty.event')
      : this.i18n.t('mural.predictions.empty.app');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.preloadEntries) {
      this.loadedEntries = this.entries;
      this.loading = false;
      return;
    }
    if (!changes['scope'] && !changes['scopeId'] && !changes['preloadEntries']) {
      return;
    }
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.loadedEntries = await this.fanPredictionService.getRankings(this.scope, this.scopeId);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
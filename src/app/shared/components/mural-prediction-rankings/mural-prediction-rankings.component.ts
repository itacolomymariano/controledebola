import { Component, Input, OnChanges } from '@angular/core';
import { PredictionRankingEntry } from '../../../core/models/fan-prediction.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralScope } from '../../../core/models/mural.model';
import { FanPredictionService } from '../../../core/services/fan-prediction.service';

@Component({
  selector: 'app-mural-prediction-rankings',
  templateUrl: './mural-prediction-rankings.component.html',
  styleUrls: ['./mural-prediction-rankings.component.scss'],
  standalone: false,
})
export class MuralPredictionRankingsComponent implements OnChanges {
  @Input({ required: true }) scope!: MuralScope;
  @Input() scopeId?: string;
  @Input() entries: PredictionRankingEntry[] = [];
  @Input() preloadEntries = false;
  @Input() shareContext: MuralShareContext | null = null;

  loading = false;
  loadedEntries: PredictionRankingEntry[] = [];

  get emptyMessage(): string {
    return this.scope === 'event'
      ? 'Nenhum palpite registrado neste evento.'
      : 'Sem palpites pontuados ainda.';
  }

  constructor(private readonly fanPredictionService: FanPredictionService) {}

  ngOnChanges(): void {
    if (this.preloadEntries) {
      this.loadedEntries = this.entries;
      this.loading = false;
      return;
    }
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.loadedEntries = await this.fanPredictionService.getRankings(this.scope, this.scopeId);
    } finally {
      this.loading = false;
    }
  }
}

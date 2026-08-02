import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AmateurLegendAthlete,
  LEGEND_ATHLETE_RELATIONSHIP_OPTIONS,
} from '../../core/models/amateur-legend.model';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';

@Component({
  selector: 'app-legend-athlete-view',
  templateUrl: './legend-athlete-view.page.html',
  styleUrls: ['./legend-athlete-view.page.scss'],
  standalone: false,
})
export class LegendAthleteViewPage {
  loading = true;
  athlete: AmateurLegendAthlete | null = null;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly legendService: AmateurLegendService
  ) {}

  ionViewWillEnter(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load(id);
  }

  relationshipLabel(value: string | undefined): string {
    return LEGEND_ATHLETE_RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? '—';
  }

  formatDate(value: string | undefined): string {
    if (!value?.trim()) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  private async load(id: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.athlete = null;
    try {
      if (!id.trim()) {
        this.errorMessage = 'Atleta lenda nao encontrado.';
        return;
      }
      this.athlete = await this.legendService.getAthlete(id);
      if (!this.athlete) {
        this.errorMessage = 'Atleta lenda nao encontrado.';
      }
    } catch {
      this.errorMessage = 'Nao foi possivel carregar o perfil da lenda.';
    } finally {
      this.loading = false;
    }
  }
}

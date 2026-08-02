import { Component, Input } from '@angular/core';
import { MuralLocationCount, MuralParticipantLocationStats } from '../../../core/models/mural-participant-stats.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralScope } from '../../../core/models/mural.model';
import {
  cityBelongsToState,
  displayCityName,
  displayNeighborhoodName,
  neighborhoodBelongsToCity,
} from '../../../core/utils/mural-location-drilldown.util';

type ParticipantStatsLevel = 'states' | 'cities' | 'neighborhoods';

interface ParticipantStatsCard {
  label: string;
  count: number;
  subLabel: string;
  subCount: number;
}

@Component({
  selector: 'app-mural-participant-stats',
  templateUrl: './mural-participant-stats.component.html',
  styleUrls: ['./mural-participant-stats.component.scss'],
  standalone: false,
})
export class MuralParticipantStatsComponent {
  @Input() stats: MuralParticipantLocationStats | null = null;
  @Input() scope: MuralScope = 'app';
  @Input() shareContext: MuralShareContext | null = null;

  level: ParticipantStatsLevel = 'states';
  selectedState = '';
  selectedCity = '';
  neighborhoodsExpanded = false;

  get useDrilldown(): boolean {
    return this.scope === 'app';
  }

  get showState(): boolean {
    return this.scope === 'app';
  }

  get showCity(): boolean {
    return true;
  }

  get showNeighborhood(): boolean {
    return this.scope === 'app' || this.scope === 'pelada' || this.scope === 'event';
  }

  get neighborhoodCount(): number {
    return this.stats?.byNeighborhood?.length ?? 0;
  }

  get scopeLabel(): string {
    if (this.scope === 'event') return 'evento';
    if (this.scope === 'pelada') return 'pelada';
    return 'app';
  }

  get breadcrumb(): string {
    if (!this.useDrilldown) return '';
    if (this.level === 'states') return 'Estados';
    if (this.level === 'cities') return `${this.selectedState} · Cidades`;
    return `${this.selectedCity} · Bairros`;
  }

  get stateCards(): ParticipantStatsCard[] {
    if (!this.stats?.byState.length) return [];
    return this.stats.byState.map((row) => ({
      label: row.label,
      count: row.count,
      subLabel: 'Cidades',
      subCount: this.citiesForState(row.label).length,
    }));
  }

  get cityCards(): ParticipantStatsCard[] {
    return this.citiesForState(this.selectedState).map((row) => ({
      label: displayCityName(row.label),
      count: row.count,
      subLabel: 'Bairros',
      subCount: this.neighborhoodsForCity(row.label).length,
    }));
  }

  get neighborhoodCards(): ParticipantStatsCard[] {
    return this.neighborhoodsForCity(this.selectedCity).map((row) => ({
      label: displayNeighborhoodName(row.label),
      count: row.count,
      subLabel: '',
      subCount: 0,
    }));
  }

  openNeighborhoods(): void {
    this.neighborhoodsExpanded = true;
  }

  closeNeighborhoods(): void {
    this.neighborhoodsExpanded = false;
  }

  openState(state: string): void {
    this.selectedState = state;
    this.selectedCity = '';
    this.level = 'cities';
  }

  openCity(cityLabel: string): void {
    const match = this.citiesForState(this.selectedState).find(
      (row) => displayCityName(row.label) === cityLabel
    );
    this.selectedCity = match?.label ?? cityLabel;
    this.level = 'neighborhoods';
  }

  backLevel(): void {
    if (this.level === 'neighborhoods') {
      this.level = 'cities';
      this.selectedCity = '';
      return;
    }
    if (this.level === 'cities') {
      this.level = 'states';
      this.selectedState = '';
    }
  }

  private citiesForState(state: string): MuralLocationCount[] {
    if (!this.stats?.byCity.length || !state.trim()) return [];
    return this.stats.byCity.filter((row) => cityBelongsToState(row.label, state));
  }

  private neighborhoodsForCity(cityLabel: string): MuralLocationCount[] {
    if (!this.stats?.byNeighborhood.length || !cityLabel.trim()) return [];
    const state = this.selectedState.trim() || undefined;
    return this.stats.byNeighborhood.filter((row) =>
      neighborhoodBelongsToCity(row.label, displayCityName(cityLabel), state)
    );
  }
}

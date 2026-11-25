import { Component, Input } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { MuralLocationCount, MuralParticipantLocationStats } from '../../../core/models/mural-participant-stats.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralScope } from '../../../core/models/mural.model';
import {
  cityBelongsToState,
  displayCityName,
  displayNeighborhoodName,
  neighborhoodBelongsToCity,
} from '../../../core/utils/mural-location-drilldown.util';
import { muralPlayfulToneByIndex } from '../../../core/utils/mural-playful-tone.util';
import { PlayfulCardTone } from '../playful-card/playful-card.component';

type ParticipantStatsLevel = 'states' | 'cities' | 'neighborhoods';

interface ParticipantStatsCard {
  label: string;
  count: number;
  subLine: string;
}

@Component({
  selector: 'app-mural-participant-stats',
  templateUrl: './mural-participant-stats.component.html',
  styleUrls: ['./mural-participant-stats.component.scss'],
  standalone: false,
})
export class MuralParticipantStatsComponent {
  constructor(private readonly i18n: I18nService) {}

  @Input() stats: MuralParticipantLocationStats | null = null;
  @Input() scope: MuralScope = 'app';
  @Input() shareContext: MuralShareContext | null = null;
  @Input() playfulChrome = false;

  drilldownTone(index: number): PlayfulCardTone {
    return muralPlayfulToneByIndex(index);
  }
  @Input() filterCaption = '';

  level: ParticipantStatsLevel = 'states';
  selectedState = '';
  selectedCity = '';
  neighborhoodsExpanded = false;

  get useDrilldown(): boolean {
    if (this.scope === 'app') return true;
    return this.scope === 'event' && !!(this.stats?.byState?.length);
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
    return this.i18n.t(`mural.stats.scope.${this.scope}`);
  }

  get breadcrumb(): string {
    if (!this.useDrilldown) return '';
    if (this.level === 'states') return this.i18n.t('mural.stats.breadcrumb.states');
    if (this.level === 'cities') {
      return this.i18n.t('mural.stats.breadcrumb.cities', { state: this.selectedState });
    }
    return this.i18n.t('mural.stats.breadcrumb.neighborhoods', { city: this.selectedCity });
  }

  get stateCards(): ParticipantStatsCard[] {
    if (!this.stats?.byState?.length) return [];
    return this.stats.byState.map((row) => ({
      label: row.label,
      count: row.count,
      subLine: this.i18n.t('mural.stats.subCitiesLine', {
        count: this.citiesForState(row.label).length,
      }),
    }));
  }

  get cityCards(): ParticipantStatsCard[] {
    return this.citiesForState(this.selectedState).map((row) => ({
      label: displayCityName(row.label),
      count: row.count,
      subLine: this.i18n.t('mural.stats.subNeighborhoodsLine', {
        count: this.neighborhoodsForCity(row.label).length,
      }),
    }));
  }

  get neighborhoodCards(): ParticipantStatsCard[] {
    return this.neighborhoodsForCity(this.selectedCity).map((row) => ({
      label: displayNeighborhoodName(row.label),
      count: row.count,
      subLine: '',
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
    if (!this.stats?.byCity?.length || !state.trim()) return [];
    return this.stats.byCity.filter((row) => cityBelongsToState(row.label, state));
  }

  private neighborhoodsForCity(cityLabel: string): MuralLocationCount[] {
    if (!this.stats?.byNeighborhood?.length || !cityLabel.trim()) return [];
    const state = this.selectedState.trim() || undefined;
    return this.stats.byNeighborhood.filter((row) =>
      neighborhoodBelongsToCity(row.label, displayCityName(cityLabel), state)
    );
  }
}

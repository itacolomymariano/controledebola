import { Component, Input } from '@angular/core';
import { MURAL_TARGET_ROLES, MuralTargetRole } from '../../../core/models/event-performance.model';
import { MuralLocationTopGroup, MuralLocationTopRankings } from '../../../core/models/mural-location-top.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralRankingEntry } from '../../../core/models/mural.model';
import { muralRankingDisplayScore } from '../../../core/utils/mural-ranking.util';
import {
  cityBelongsToState,
  displayCityName,
  displayNeighborhoodName,
  neighborhoodBelongsToCity,
} from '../../../core/utils/mural-location-drilldown.util';

type TopRankingsLevel = 'states' | 'stateDetail' | 'cities' | 'cityDetail' | 'neighborhoods' | 'neighborhoodDetail';

const ROLE_LABELS: Record<MuralTargetRole, string> = {
  athlete: 'Atletas',
  goalkeeper: 'Goleiros',
  referee: 'Juízes / Árbitros',
  scout: 'Scouts / Mesários',
  journalist: 'Jornalistas',
  cameraman: 'Cinegrafistas',
  narrator: 'Narradores',
  coach: 'Treinadores',
  physical_trainer: 'Preparadores Físicos',
  masseur: 'Massagistas',
  kitman: 'Roupeiros',
  gandula: 'Gandulas',
};

@Component({
  selector: 'app-mural-location-top-rankings',
  templateUrl: './mural-location-top-rankings.component.html',
  styleUrls: ['./mural-location-top-rankings.component.scss'],
  standalone: false,
})
export class MuralLocationTopRankingsComponent {
  @Input() rankings: MuralLocationTopRankings | null = null;
  @Input() shareContext: MuralShareContext | null = null;

  level: TopRankingsLevel = 'states';
  selectedState = '';
  selectedCityLabel = '';
  selectedNeighborhoodLabel = '';

  readonly muralRoles = MURAL_TARGET_ROLES;

  get breadcrumb(): string {
    switch (this.level) {
      case 'states':
        return 'Top 3 por estado';
      case 'stateDetail':
        return `Top 3 · ${this.selectedState}`;
      case 'cities':
        return `Top 3 por cidade · ${this.selectedState}`;
      case 'cityDetail':
        return `Top 3 · ${this.cityDisplayName(this.selectedCityLabel)}`;
      case 'neighborhoods':
        return `Top 3 por bairro · ${this.cityDisplayName(this.selectedCityLabel)}`;
      case 'neighborhoodDetail':
        return `Top 3 · ${this.neighborhoodDisplayName(this.selectedNeighborhoodLabel)}`;
      default:
        return '';
    }
  }

  get stateGroups(): MuralLocationTopGroup[] {
    return this.rankings?.byState ?? [];
  }

  get selectedStateGroup(): MuralLocationTopGroup | null {
    return this.stateGroups.find((group) => group.label === this.selectedState) ?? null;
  }

  get cityGroupsForState(): MuralLocationTopGroup[] {
    if (!this.rankings?.byCity.length || !this.selectedState.trim()) return [];
    return this.rankings.byCity.filter(
      (group) =>
        cityBelongsToState(group.label, this.selectedState) && this.hasAnyRankings(group)
    );
  }

  get selectedCityGroup(): MuralLocationTopGroup | null {
    return (
      this.rankings?.byCity.find((group) => group.label === this.selectedCityLabel) ?? null
    );
  }

  get neighborhoodGroupsForCity(): MuralLocationTopGroup[] {
    if (!this.rankings?.byNeighborhood.length || !this.selectedCityLabel.trim()) return [];
    return this.rankings.byNeighborhood.filter(
      (group) =>
        neighborhoodBelongsToCity(
          group.label,
          displayCityName(this.selectedCityLabel),
          this.selectedState
        ) && this.hasAnyRankings(group)
    );
  }

  get selectedNeighborhoodGroup(): MuralLocationTopGroup | null {
    return (
      this.rankings?.byNeighborhood.find((group) => group.label === this.selectedNeighborhoodLabel) ??
      null
    );
  }

  roleLabel(role: MuralTargetRole): string {
    return ROLE_LABELS[role];
  }

  rankingScore(entry: MuralRankingEntry): number {
    return muralRankingDisplayScore(entry);
  }

  hasAnyRankings(group: MuralLocationTopGroup): boolean {
    return this.muralRoles.some((role) => (group.rankings[role]?.length ?? 0) > 0);
  }

  cityDisplayName(cityLabel: string): string {
    return displayCityName(cityLabel);
  }

  neighborhoodDisplayName(neighborhoodLabel: string): string {
    return displayNeighborhoodName(neighborhoodLabel);
  }

  openState(state: string): void {
    this.selectedState = state;
    this.selectedCityLabel = '';
    this.selectedNeighborhoodLabel = '';
    this.level = 'stateDetail';
  }

  openCitiesList(): void {
    this.selectedCityLabel = '';
    this.selectedNeighborhoodLabel = '';
    this.level = 'cities';
  }

  openCity(cityLabel: string): void {
    this.selectedCityLabel = cityLabel;
    this.selectedNeighborhoodLabel = '';
    this.level = 'cityDetail';
  }

  openNeighborhoodsList(): void {
    this.selectedNeighborhoodLabel = '';
    this.level = 'neighborhoods';
  }

  openNeighborhood(neighborhoodLabel: string): void {
    this.selectedNeighborhoodLabel = neighborhoodLabel;
    this.level = 'neighborhoodDetail';
  }

  backLevel(): void {
    switch (this.level) {
      case 'stateDetail':
        this.level = 'states';
        this.selectedState = '';
        break;
      case 'cities':
        this.level = 'stateDetail';
        break;
      case 'cityDetail':
        this.level = 'cities';
        this.selectedCityLabel = '';
        break;
      case 'neighborhoods':
        this.level = 'cityDetail';
        break;
      case 'neighborhoodDetail':
        this.level = 'neighborhoods';
        this.selectedNeighborhoodLabel = '';
        break;
      default:
        break;
    }
  }
}

import { ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  MURAL_TARGET_ROLES,
  MuralTargetRole,
} from '../../../core/models/event-performance.model';
import { MuralLocationTopGroup, MuralLocationTopRankings } from '../../../core/models/mural-location-top.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralRankingEntry } from '../../../core/models/mural.model';
import { I18nService } from '../../../core/services/i18n.service';
import { muralRankingDisplayScore } from '../../../core/utils/mural-ranking.util';
import {
  cityBelongsToState,
  displayCityName,
  displayNeighborhoodName,
  neighborhoodBelongsToCity,
} from '../../../core/utils/mural-location-drilldown.util';
import {
  muralPlayfulNestedTone,
  muralPlayfulToneByIndex,
} from '../../../core/utils/mural-playful-tone.util';
import { PlayfulCardTone } from '../playful-card/playful-card.component';

type TopRankingsLevel = 'states' | 'stateDetail' | 'cities' | 'cityDetail' | 'neighborhoods' | 'neighborhoodDetail';

const ROLE_I18N_KEYS: Record<MuralTargetRole, string> = {
  athlete: 'profileRole.athlete',
  goalkeeper: 'profileRole.goalkeeper',
  referee: 'profileRole.referee',
  scout: 'profileRole.scout',
  journalist: 'profileRole.journalist',
  cameraman: 'profileRole.cameraman',
  narrator: 'profileRole.narrator',
  coach: 'profileRole.coach',
  physical_trainer: 'profileRole.physical_trainer',
  masseur: 'profileRole.masseur',
  kitman: 'profileRole.kitman',
  gandula: 'profileRole.gandula',
  fan: 'profileRole.fan',
  gatekeeper: 'profileRole.gatekeeper',
};

@Component({
  selector: 'app-mural-location-top-rankings',
  templateUrl: './mural-location-top-rankings.component.html',
  styleUrls: ['./mural-location-top-rankings.component.scss'],
  standalone: false,
})
export class MuralLocationTopRankingsComponent implements OnDestroy {
  @Input() rankings: MuralLocationTopRankings | null = null;
  @Input() shareContext: MuralShareContext | null = null;
  @Input() filterCaption = '';
  @Input() playfulChrome = false;

  level: TopRankingsLevel = 'states';
  selectedState = '';
  selectedCityLabel = '';
  selectedNeighborhoodLabel = '';

  readonly muralRoles = MURAL_TARGET_ROLES;
  private localeSub?: Subscription;

  constructor(
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  participantCountLabel(count: number): string {
    return this.i18n.t('mural.locationTop.participantCount', { count });
  }

  roleHeading(role: MuralTargetRole): string {
    return this.i18n.t('mural.locationTop.roleHeading', { role: this.roleLabel(role) });
  }

  groupCardTitle(label: string): string {
    return this.i18n.t('mural.locationTop.cardTitle', { label });
  }

  get breadcrumb(): string {
    switch (this.level) {
      case 'states':
        return this.i18n.t('mural.locationTop.breadcrumb.states');
      case 'stateDetail':
        return this.i18n.t('mural.locationTop.breadcrumb.stateDetail', { state: this.selectedState });
      case 'cities':
        return this.i18n.t('mural.locationTop.breadcrumb.cities', { state: this.selectedState });
      case 'cityDetail':
        return this.i18n.t('mural.locationTop.breadcrumb.cityDetail', {
          city: this.cityDisplayName(this.selectedCityLabel),
        });
      case 'neighborhoods':
        return this.i18n.t('mural.locationTop.breadcrumb.neighborhoods', {
          city: this.cityDisplayName(this.selectedCityLabel),
        });
      case 'neighborhoodDetail':
        return this.i18n.t('mural.locationTop.breadcrumb.neighborhoodDetail', {
          neighborhood: this.neighborhoodDisplayName(this.selectedNeighborhoodLabel),
        });
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
    const key = ROLE_I18N_KEYS[role];
    return key ? this.i18n.t(key) : role;
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

  roleCardTone(roleIndex: number): PlayfulCardTone {
    return muralPlayfulToneByIndex(roleIndex);
  }

  drilldownTone(index: number): PlayfulCardTone {
    return muralPlayfulToneByIndex(index);
  }

  locationNestedTone(parent: PlayfulCardTone, childIndex: number): PlayfulCardTone {
    return muralPlayfulNestedTone(parent, childIndex);
  }
}
import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  BRAZILIAN_PRO_TEAMS,
  BrazilianSerie,
  BrazilianTeamOption,
  SERIE_LABELS,
  TEAMS_BY_SERIE,
} from '../../../core/data/brazilian-teams.data';

@Component({
  selector: 'app-team-picker',
  templateUrl: './team-picker.component.html',
  styleUrls: ['./team-picker.component.scss'],
  standalone: false,
})
export class TeamPickerComponent {
  @Input({ required: true }) control!: FormControl<string | null>;
  @Input() disabled = false;

  modalOpen = false;
  search = '';
  series: BrazilianSerie[] = ['A', 'B', 'C', 'D'];

  get selectedTeam(): BrazilianTeamOption | undefined {
    const value = this.control.value;
    if (!value) {
      return undefined;
    }
    return BRAZILIAN_PRO_TEAMS.find((team) => team.name === value);
  }

  serieLabel(serie: BrazilianSerie): string {
    return SERIE_LABELS[serie];
  }

  teamsForSerie(serie: BrazilianSerie): BrazilianTeamOption[] {
    const query = this.search.trim().toLowerCase();
    const teams = TEAMS_BY_SERIE[serie];
    if (!query) {
      return teams;
    }
    return teams.filter((team) => team.name.toLowerCase().includes(query));
  }

  hasResults(): boolean {
    return this.series.some((serie) => this.teamsForSerie(serie).length > 0);
  }

  openModal(): void {
    if (this.disabled) {
      return;
    }
    this.search = '';
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  selectTeam(team: BrazilianTeamOption): void {
    this.control.setValue(team.name);
    this.control.markAsDirty();
    this.closeModal();
  }

  clearSelection(): void {
    this.control.setValue('');
    this.control.markAsDirty();
  }
}

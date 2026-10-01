import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AmateurLegendAthlete, AmateurLegendTeam } from '../../core/models/amateur-legend.model';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';

@Component({
  selector: 'app-legends-hub',
  templateUrl: './legends-hub.page.html',
  styleUrls: ['./legends-hub.page.scss'],
  standalone: false,
})
export class LegendsHubPage {
  loading = true;
  search = '';
  athletes: AmateurLegendAthlete[] = [];
  teams: AmateurLegendTeam[] = [];

  constructor(
    private readonly legendService: AmateurLegendService,
    private readonly router: Router
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      [this.athletes, this.teams] = await Promise.all([
        this.legendService.listAthletes(this.search),
        this.legendService.listTeams(this.search),
      ]);
    } finally {
      this.loading = false;
    }
  }

  get hasSearchTerm(): boolean {
    return this.search.trim().length >= 2;
  }

  get hasMatches(): boolean {
    return this.athletes.length > 0 || this.teams.length > 0;
  }

  onSearchChange(value: string): void {
    this.search = value;
    void this.load();
  }

  openAthleteForm(): void {
    void this.router.navigate(['/legends/athlete/new'], {
      queryParams: this.legendFormQueryParams(),
    });
  }

  openTeamForm(): void {
    void this.router.navigate(['/legends/team/new'], {
      queryParams: this.legendFormQueryParams(),
    });
  }

  private legendFormQueryParams(): Record<string, string> {
    const term = this.search.trim();
    return term.length >= 2 ? { name: term, apelido: term } : {};
  }

  openAthlete(athlete: AmateurLegendAthlete): void {
    if (!athlete.id?.trim()) return;
    void this.router.navigate(['/legends/athlete', athlete.id]);
  }

  back(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }
}

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AmateurLegendAthlete, AmateurLegendTeam } from '../../core/models/amateur-legend.model';
import { AuthService } from '../../core/services/auth.service';
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
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  canEditLegend(registeredByUserId: string | undefined): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    return !!userId && !!registeredByUserId && registeredByUserId === userId;
  }

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

  openTeam(team: AmateurLegendTeam): void {
    if (!team.id?.trim()) return;
    void this.router.navigate(['/legends/team', team.id]);
  }

  editAthlete(event: Event, athlete: AmateurLegendAthlete): void {
    event.stopPropagation();
    if (!athlete.id?.trim() || !this.canEditLegend(athlete.registeredByUserId)) return;
    void this.router.navigate(['/legends/athlete/edit', athlete.id]);
  }

  editTeam(event: Event, team: AmateurLegendTeam): void {
    event.stopPropagation();
    if (!team.id?.trim() || !this.canEditLegend(team.registeredByUserId)) return;
    void this.router.navigate(['/legends/team/edit', team.id]);
  }

  back(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }
}

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AmateurLegendTeam,
  LEGEND_TEAM_RELATIONSHIP_OPTIONS,
} from '../../core/models/amateur-legend.model';
import { AuthService } from '../../core/services/auth.service';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';

@Component({
  selector: 'app-legend-team-view',
  templateUrl: './legend-team-view.page.html',
  styleUrls: ['./legend-team-view.page.scss'],
  standalone: false,
})
export class LegendTeamViewPage {
  loading = true;
  team: AmateurLegendTeam | null = null;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly legendService: AmateurLegendService
  ) {}

  get canEditLegend(): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    return !!userId && !!this.team?.registeredByUserId && this.team.registeredByUserId === userId;
  }

  editLegend(): void {
    if (!this.team?.id || !this.canEditLegend) return;
    void this.router.navigate(['/legends/team/edit', this.team.id]);
  }

  ionViewWillEnter(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load(id);
  }

  relationshipLabel(value: string | undefined): string {
    return LEGEND_TEAM_RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? '—';
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
    this.team = null;
    try {
      if (!id.trim()) {
        this.errorMessage = 'Time lenda nao encontrado.';
        return;
      }
      this.team = await this.legendService.getTeam(id);
      if (!this.team) {
        this.errorMessage = 'Time lenda nao encontrado.';
      }
    } catch {
      this.errorMessage = 'Nao foi possivel carregar o perfil do time lenda.';
    } finally {
      this.loading = false;
    }
  }
}

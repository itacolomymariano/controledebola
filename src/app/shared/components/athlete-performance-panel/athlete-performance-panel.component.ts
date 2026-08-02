import { Component, Input } from '@angular/core';
import { AthletePerformanceDashboard } from '../../../core/services/athlete-performance.service';

@Component({
  selector: 'app-athlete-performance-panel',
  templateUrl: './athlete-performance-panel.component.html',
  styleUrls: ['./athlete-performance-panel.component.scss'],
  standalone: false,
})
export class AthletePerformancePanelComponent {
  @Input() dashboard: AthletePerformanceDashboard | null = null;
  @Input() loading = false;

  statRows(): Array<{ label: string; value: number }> {
    if (!this.dashboard) return [];
    const t = this.dashboard.totals;
    return [
      { label: 'Gols a favor', value: t.goals },
      { label: 'Gols contra', value: t.ownGoals },
      { label: 'Gol de cabeca', value: t.goalsHeader },
      { label: 'Gol de falta', value: t.goalsFreeKick },
      { label: 'Gol pe direito', value: t.goalsRightFoot },
      { label: 'Gol pe esquerdo', value: t.goalsLeftFoot },
      { label: 'Gol olimpico', value: t.goalsOlympic },
      { label: 'Gol maluco', value: t.goalsCrazy },
      { label: 'Gol de penalti', value: t.goalsPenalty },
      { label: 'Faltas cometidas', value: t.foulsCommitted },
      { label: 'Faltas cometidas de jogo', value: t.foulsCommittedGame },
      { label: 'Faltas cometidas de penalti', value: t.foulsCommittedPenalty },
      { label: 'Faltas sofridas', value: t.foulsSuffered },
      { label: 'Faltas sofridas de jogo', value: t.foulsSufferedGame },
      { label: 'Faltas sofridas de penalti', value: t.foulsSufferedPenalty },
      { label: 'Defesas', value: t.saves },
      { label: 'Defesas de penalti', value: t.savesPenalty },
      { label: 'Defesas de falta', value: t.savesFreeKick },
      { label: 'Defesas de jogo corrido', value: t.savesOpenPlay },
      { label: 'Gols sofridos', value: t.goalsConceded },
      { label: 'Gols sofridos de penalti', value: t.goalsConcededPenalty },
      { label: 'Gols sofridos de falta', value: t.goalsConcededFreeKick },
      { label: 'Gols sofridos de jogo corrido', value: t.goalsConcededOpenPlay },
      { label: 'Assistencias com a mao', value: t.gkAssistsHand },
      { label: 'Assistencias com os pes', value: t.gkAssistsFeet },
      { label: 'Finalizacoes no alvo', value: t.shotsOnTarget },
      { label: 'Finalizacoes fora', value: t.shotsOffTarget },
      { label: 'Cartoes amarelos', value: t.yellowCards },
      { label: 'Cartoes vermelhos', value: t.redCards },
      { label: 'Penaltis cometidos', value: t.penaltiesCommitted },
      { label: 'Penaltis sofridos', value: t.penaltiesSuffered },
    ];
  }

  barWidth(value: number, max: number): string {
    if (!max) return '0%';
    return `${Math.max(4, Math.round((value / max) * 100))}%`;
  }

  chartMax(): number {
    if (!this.dashboard) return 1;
    const c = this.dashboard.charts;
    return Math.max(c.shotsOnTarget, c.shotsOffTarget, c.goals, 1);
  }

  foulChartMax(): number {
    if (!this.dashboard) return 1;
    const c = this.dashboard.charts;
    return Math.max(c.foulsCommitted, c.foulsSuffered, 1);
  }
}

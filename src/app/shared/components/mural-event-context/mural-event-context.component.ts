import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MuralShareContext } from '../../../core/models/mural-share.model';

@Component({
  selector: 'app-mural-event-context',
  templateUrl: './mural-event-context.component.html',
  styleUrls: ['./mural-event-context.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralEventContextComponent {
  @Input() context: MuralShareContext | null = null;

  get show(): boolean {
    return this.context?.scope === 'event';
  }

  get eventDateLabel(): string {
    const raw = this.context?.eventStartTime;
    if (!raw) return '';
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  get showTeamMatch(): boolean {
    return !!(this.context?.homeTeamName && this.context?.awayTeamName);
  }

  get showScores(): boolean {
    return (
      this.showTeamMatch &&
      this.context!.homeScore != null &&
      this.context!.awayScore != null
    );
  }
}

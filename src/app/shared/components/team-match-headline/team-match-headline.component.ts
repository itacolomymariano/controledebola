import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-team-match-headline',
  templateUrl: './team-match-headline.component.html',
  styleUrls: ['./team-match-headline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TeamMatchHeadlineComponent {
  @Input({ required: true }) homeTeamName!: string;
  @Input({ required: true }) awayTeamName!: string;
  @Input() homeTeamShieldUrl?: string;
  @Input() awayTeamShieldUrl?: string;
  @Input() homeScore?: number | null;
  @Input() awayScore?: number | null;
  @Input() centered = false;

  get showScores(): boolean {
    return this.homeScore != null && this.awayScore != null;
  }
}

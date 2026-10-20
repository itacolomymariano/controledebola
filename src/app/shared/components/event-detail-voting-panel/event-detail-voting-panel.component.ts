import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { EventRegistrationListItem } from '../../../core/models/event-registration.model';
import { teamSideLabel } from '../../../core/models/event.model';
import { RegistrationService } from '../../../core/services/registration.service';

@Component({
  selector: 'app-event-detail-voting-panel',
  templateUrl: './event-detail-voting-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventDetailVotingPanelComponent {
  @Input({ required: true }) votingTargets!: EventRegistrationListItem[];
  @Input() votingPeriodNote = '';
  @Input() loadingVotes = false;
  @Input() canVote = false;
  @Input() votesSubmitted = false;
  @Input() voteScores: Record<string, number | null> = {};
  @Input() voteScoreOptions: number[] = [];
  /** Notas 10 ainda permitidas nesta cedula (max. 2 por evento). */
  @Input() scoreTenRemaining = 2;
  @Input() savingVotes = false;
  @Input() isTeamMatch = false;
  @Input() homeTeamName?: string;
  @Input() awayTeamName?: string;

  @Output() back = new EventEmitter<void>();
  @Output() submitVotes = new EventEmitter<void>();

  constructor(readonly registrationService: RegistrationService) {}

  participantTeamLabel(participant: EventRegistrationListItem): string {
    const fromSide = teamSideLabel(participant.teamSide, this.homeTeamName, this.awayTeamName);
    return participant.teamName?.trim() || fromSide || 'Time nao definido';
  }

  showTeamForParticipant(participant: EventRegistrationListItem): boolean {
    return this.isTeamMatch && participant.role === 'athlete';
  }
}

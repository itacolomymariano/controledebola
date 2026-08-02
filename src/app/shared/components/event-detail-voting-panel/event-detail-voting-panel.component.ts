import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { EventRegistrationListItem } from '../../../core/models/event-registration.model';
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
  @Input() savingVotes = false;

  @Output() back = new EventEmitter<void>();
  @Output() submitVotes = new EventEmitter<void>();

  constructor(readonly registrationService: RegistrationService) {}
}

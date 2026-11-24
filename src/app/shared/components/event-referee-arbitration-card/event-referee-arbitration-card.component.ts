import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PeladaEvent } from '../../../core/models/event.model';
import { EventInviteCandidate } from '../../../core/models/referee-invitation.model';
import {
  RefereeArbitrationViewModel,
  RefereeHiringPhase,
} from '../../../core/utils/referee-hiring-state.util';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-event-referee-arbitration-card',
  templateUrl: './event-referee-arbitration-card.component.html',
  styleUrls: ['./event-referee-arbitration-card.component.scss'],
  standalone: false,
})
export class EventRefereeArbitrationCardComponent {
  @Input({ required: true }) event!: PeladaEvent;
  @Input() viewModel: RefereeArbitrationViewModel | null = null;
  @Input() peladaShortcuts: EventInviteCandidate[] = [];
  @Input() loading = false;

  @Output() manageReferee = new EventEmitter<void>();
  @Output() openInbox = new EventEmitter<void>();
  @Output() reinvitePeladaReferee = new EventEmitter<EventInviteCandidate>();

  constructor(private readonly i18n: I18nService) {}

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  get phase(): RefereeHiringPhase {
    return this.viewModel?.phase ?? 'none';
  }

  phaseLabel(): string {
    const key = `eventRefereeArbitration.phase.${this.phase}`;
    return this.t(key);
  }

  phaseColor(): string {
    switch (this.phase) {
      case 'present':
      case 'confirmed':
        return 'success';
      case 'awaiting_referee_response':
      case 'awaiting_opponent_approval':
        return 'warning';
      case 'rejected':
        return 'danger';
      default:
        return 'medium';
    }
  }

  timelineStepLabel(stepId: 'proposal' | 'opponent' | 'referee'): string {
    return this.t(`eventRefereeArbitration.timeline.${stepId}`);
  }

  shortcutName(candidate: EventInviteCandidate): string {
    return candidate.apelido?.trim() || candidate.userName?.trim() || this.t('eventRefereeArbitration.refereeFallback');
  }
}
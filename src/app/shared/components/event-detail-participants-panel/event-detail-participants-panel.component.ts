import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PeladaEvent, hasPositiveParticipationFee } from '../../../core/models/event.model';
import {
  EventRegistration,
  EventRegistrationListItem,
} from '../../../core/models/event-registration.model';
import { EventService } from '../../../core/services/event.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { formatEffectiveMembershipLabel } from '../../../core/utils/arrival-order.util';
import {
  registrationCardColor,
  registrationCardTitle,
} from '../../../core/utils/event-detail-display.util';
import {
  isContractHiredRegistration,
  registrationRequiresParticipationPayment,
} from '../../../core/utils/registration-hiring.util';

export type EventDetailParticipantsPanelMode = 'admin' | 'user';

@Component({
  selector: 'app-event-detail-participants-panel',
  templateUrl: './event-detail-participants-panel.component.html',
  styleUrls: ['./event-detail-participants-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventDetailParticipantsPanelComponent {
  @Input({ required: true }) mode!: EventDetailParticipantsPanelMode;
  @Input({ required: true }) event!: PeladaEvent;
  @Input() registration: EventRegistration | null = null;

  @Input() participantsCount = 0;
  @Input() filteredParticipants: EventRegistrationListItem[] = [];

  @Input() confirmedParticipantsCount = 0;
  @Input() filteredConfirmedParticipants: EventRegistrationListItem[] = [];

  @Input() participantSearch = '';
  @Input() supportsArrivalOrder = false;
  @Input() gateTicketControlEnabled = false;
  @Input() cancelling = false;
  @Input() updatingPaymentId = '';
  @Input() issuingTicketId = '';
  @Input() cancellingTicketId = '';
  @Input() resolvingProfileId = '';
  @Input() activeSocioUserIds: ReadonlySet<string> = new Set<string>();

  @Output() back = new EventEmitter<void>();
  @Output() participantSearchChange = new EventEmitter<string>();
  @Output() cancelRegistration = new EventEmitter<void>();
  @Output() arrivalAction = new EventEmitter<{
    participant: EventRegistrationListItem;
    action: 'check_in' | 'undo';
  }>();
  @Output() paymentExemptToggle = new EventEmitter<{
    participant: EventRegistrationListItem;
    event: CustomEvent;
  }>();
  @Output() paymentToggle = new EventEmitter<{
    participant: EventRegistrationListItem;
    event: CustomEvent;
  }>();
  @Output() issueGateTicket = new EventEmitter<EventRegistrationListItem>();
  @Output() cancelGateTicket = new EventEmitter<EventRegistrationListItem>();
  @Output() viewProfilePresentation = new EventEmitter<EventRegistrationListItem>();
  @Output() approveProfilePresentation = new EventEmitter<EventRegistrationListItem>();
  @Output() rejectProfilePresentation = new EventEmitter<EventRegistrationListItem>();

  constructor(
    readonly registrationService: RegistrationService,
    readonly eventService: EventService
  ) {}

  get isAdminMode(): boolean {
    return this.mode === 'admin';
  }

  get showPaymentAdminControls(): boolean {
    return (
      this.isAdminMode &&
      hasPositiveParticipationFee(this.event.participationFee) &&
      !this.event.isReadOnly
    );
  }

  hasPositiveParticipationFee(fee: number): boolean {
    return hasPositiveParticipationFee(fee);
  }

  isContractHired(registration: EventRegistration | EventRegistrationListItem): boolean {
    return isContractHiredRegistration(registration);
  }

  showParticipationPaymentRequest(registration: EventRegistration): boolean {
    return (
      registrationRequiresParticipationPayment(registration, this.event.participationFee) &&
      !registration.paymentConfirmed
    );
  }

  showPaymentAdminControlsFor(participant: EventRegistrationListItem): boolean {
    return (
      this.showPaymentAdminControls &&
      registrationRequiresParticipationPayment(participant, this.event.participationFee)
    );
  }

  cardTitle(registration: EventRegistration): string {
    return registrationCardTitle(registration);
  }

  cardColor(registration: EventRegistration): string {
    return registrationCardColor(registration);
  }

  effectiveConfirmationLabel(registration: EventRegistration): string {
    return this.registrationService.formatEffectiveConfirmationLabel(
      registration,
      this.event.participationFee
    );
  }

  formatParticipationFee(fee: number): string {
    return this.eventService.formatParticipationFee(fee);
  }

  hasArrived(participant: EventRegistrationListItem): boolean {
    return participant.arrivedAt != null;
  }

  participantMembershipLabel(participant: EventRegistrationListItem): string {
    return formatEffectiveMembershipLabel(
      participant.userId,
      participant.membershipType,
      this.event.adminId,
      this.activeSocioUserIds
    );
  }

  hasPendingProfilePresentation(participant: EventRegistrationListItem): boolean {
    return participant.profilePresentationStatus === 'pending';
  }

  onSearchInput(event: CustomEvent): void {
    this.participantSearchChange.emit(String(event.detail.value ?? ''));
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EventGateTicket } from '../../../core/models/event-gate-ticket.model';
import { PeladaEvent } from '../../../core/models/event.model';

export interface EventDetailGateActionTile {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
}

@Component({
  selector: 'app-event-detail-gate-panel',
  templateUrl: './event-detail-gate-panel.component.html',
  styleUrls: ['./event-detail-gate-panel.component.scss'],
  standalone: false,
})
export class EventDetailGatePanelComponent {
  @Input({ required: true }) event!: PeladaEvent;
  @Input() gateActionTileRows: EventDetailGateActionTile[][] = [];
  @Input() showMyGateTicketView = false;
  @Input() loadingGateTicket = false;
  @Input() myGateTicket: EventGateTicket | null = null;
  @Input() gateTicketLocation = '';
  @Input() registrationConfirmed = false;

  @Output() back = new EventEmitter<void>();
  @Output() closeTicketView = new EventEmitter<void>();
  @Output() gateAction = new EventEmitter<string>();
  @Output() qrRendered = new EventEmitter<void>();
}

export interface EventGateTicket {
  registrationId: string;
  eventId: string;
  participantName: string;
  participantApelido: string;
  eventName: string;
  eventStartTime: string;
  eventEndTime: string;
  authorizedByAdminId: string;
  authorizedByAdminName: string;
  authorizedByAdminAvatarUrl?: string;
  qrPayload: string;
  issuedAt?: string;
  cancelledAt?: string;
  entryAt?: string;
  active: boolean;
  eventLocation?: string;
}

export interface EventGateEntry {
  registrationId: string;
  participantName: string;
  participantApelido: string;
  role: string;
  entryAt: string;
  authorizedByAdminName: string;
}

export interface EventGateTicketValidation {
  valid: boolean;
  message: string;
  participantName?: string;
  participantApelido?: string;
  entryAt?: string;
  authorizedByAdminName?: string;
  alreadyEntered?: boolean;
}

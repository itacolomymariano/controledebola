import { ProfileRole } from './profile-role.model';

export type MembershipType = 'socio' | 'convidado';
export type AttendanceStatus = 'pending' | 'present' | 'absent';

export type ProfilePresentationStatus = 'pending' | 'approved' | 'rejected';

export interface EventRegistration {
  objectId: string;
  eventId: string;
  role: ProfileRole;
  apelido: string;
  committed: boolean;
  membershipType: MembershipType;
  attendance: AttendanceStatus;
  paymentConfirmed: boolean;
  paymentExempt: boolean;
  isEffectivelyConfirmed: boolean;
  /** Convidado/contratado (hiring) — nao paga taxa de participacao. */
  invitedByContract?: boolean;
  invitedAsReferee?: boolean;
  profilePresentationStatus?: ProfilePresentationStatus;
  arrivalOrder?: number;
  arrivedAt?: Date;
  gateTicketActive?: boolean;
}

export interface EventRegistrationListItem extends EventRegistration {
  userId: string;
  userName: string;
  avatarUrl?: string;
  primaryPosition?: string;
  isAnonymous?: boolean;
}

export interface RegisterForEventPayload {
  eventId: string;
  role: ProfileRole;
  apelido: string;
  committed: boolean;
  membershipType: MembershipType;
  athleteProfileId?: string;
}

export interface ScheduleConflict {
  eventId: string;
  eventName: string;
  startTime: Date;
  endTime: Date;
}

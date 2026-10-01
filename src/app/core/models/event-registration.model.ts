import { TeamSide } from './event.model';
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
  /** Valor prometido na convocacao/contratacao (0 = sem pagamento). */
  contractOfferedAmount?: number;
  profilePresentationStatus?: ProfilePresentationStatus;
  arrivalOrder?: number;
  arrivedAt?: Date;
  gateTicketActive?: boolean;
  teamSide?: TeamSide;
}

export interface EventRegistrationListItem extends EventRegistration {
  userId: string;
  userName: string;
  avatarUrl?: string;
  primaryPosition?: string;
  isAnonymous?: boolean;
  /** Idade calculada a partir da data de nascimento. */
  age?: number | null;
  /** Media ponderada de notas no mural do app (confrontos pesam 3x). */
  appAverageScore?: number | null;
  /** Nome do time no confronto (atleta/goleiro). */
  teamName?: string;
}

export interface RegisterForEventPayload {
  eventId: string;
  role: ProfileRole;
  apelido: string;
  committed: boolean;
  membershipType: MembershipType;
  athleteProfileId?: string;
  teamSide?: TeamSide;
}

export interface ScheduleConflict {
  eventId: string;
  eventName: string;
  startTime: Date;
  endTime: Date;
  source?: string;
  invitationId?: string | null;
  invitationStatus?: string;
}

export interface InvitationAcceptConflict {
  invitationId: string | null;
  invitationStatus: string;
  source: string;
  eventId: string;
  eventName: string;
  teamSide?: string;
  startTime: Date | null;
  endTime: Date | null;
  canDecline: boolean;
  hardBlock: boolean;
}

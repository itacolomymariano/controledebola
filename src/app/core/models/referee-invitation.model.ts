export type RefereeInvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type EventRoleInvitationStatus = RefereeInvitationStatus;
export type AttendanceMode = 'in_person' | 'remote';
export type SupplementaryInvitationKind = 'flag_assistant' | 'marking_assistant';
export type SupplementaryHiringMode = 'flags' | 'assistants';

export interface SupplementaryHiringOpportunity {
  invitationId: string;
  eventId: string;
  eventName: string;
  eventStartTime: Date;
  mode: SupplementaryHiringMode;
  role: 'referee' | 'scout';
}

export interface CreateSupplementaryInvitationPayload {
  eventId: string;
  invitedUserId: string;
  kind: SupplementaryInvitationKind;
  offeredAmount: number;
  responseDeadline: Date;
  invitedUserApelido?: string;
  invitedUserFullName?: string;
  invitedUserAvatarUrl?: string;
}

export interface RefereeInvitation {
  objectId: string;
  eventId: string;
  eventName: string;
  eventType: string;
  eventStartTime: Date;
  peladaId: string;
  peladaName?: string;
  role: import('./profile-role.model').ProfileRole;
  attendanceMode?: AttendanceMode;
  invitedUserId: string;
  invitedUserName: string;
  invitedUserApelido: string;
  invitedUserFullName?: string;
  invitedUserAvatarUrl?: string;
  invitedById: string;
  invitedByName: string;
  invitedByApelido?: string;
  invitedByFullName?: string;
  invitedByAvatarUrl?: string;
  status: RefereeInvitationStatus;
  offeredAmount: number;
  responseDeadline?: Date;
  responseAt?: Date;
  registrationId?: string;
  presenceConfirmed: boolean;
  arrivalAt?: Date;
  paymentConfirmedByAdmin: boolean;
  paymentConfirmedByReferee: boolean;
  paymentConfirmedByRefereeAt?: Date;
  excusedFault?: boolean;
  workCompleted: boolean;
  paymentReleased: boolean;
  cashEntryId?: string;
  createdAt?: Date;
  supplementaryKind?: SupplementaryInvitationKind;
}

export interface RefereeInviteCandidate {
  userId: string;
  userName: string;
  apelido: string;
  peladaRate?: number;
  matchRate?: number;
  avatarUrl?: string;
  city?: string;
  state?: string;
  proximityScore?: number;
}

export type EventInviteCandidate = RefereeInviteCandidate;

export interface CreateRefereeInvitationPayload {
  eventId: string;
  invitedUserId: string;
  role?: import('./profile-role.model').ProfileRole;
  attendanceMode?: AttendanceMode;
  offeredAmount: number;
  responseDeadline: Date;
  invitedUserApelido?: string;
  invitedUserFullName?: string;
  invitedUserAvatarUrl?: string;
}

export type EventRoleInvitation = RefereeInvitation;
export type CreateEventRoleInvitationPayload = CreateRefereeInvitationPayload;

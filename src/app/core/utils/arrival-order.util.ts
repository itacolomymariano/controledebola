import {
  EventRegistrationListItem,
  MembershipType,
} from '../models/event-registration.model';

export type ArrivalPriorityTier = 0 | 1 | 2;

export function isSocioMembershipType(membershipType: string | undefined): boolean {
  return String(membershipType || 'convidado') === 'socio';
}

export function isEventAdmin(userId: string, adminId: string): boolean {
  return !!adminId && userId === adminId;
}

export function isEffectiveSocio(
  userId: string,
  membershipType: MembershipType,
  activeSocioUserIds: ReadonlySet<string>
): boolean {
  if (activeSocioUserIds.has(userId)) {
    return true;
  }
  return membershipType === 'socio';
}

export function isRegularSocio(
  userId: string,
  membershipType: MembershipType,
  adminId: string,
  activeSocioUserIds: ReadonlySet<string>
): boolean {
  if (isEventAdmin(userId, adminId)) {
    return false;
  }
  return isEffectiveSocio(userId, membershipType, activeSocioUserIds);
}

export function getArrivalPriorityTier(
  userId: string,
  membershipType: MembershipType,
  adminId: string,
  activeSocioUserIds: ReadonlySet<string>
): ArrivalPriorityTier {
  if (isEventAdmin(userId, adminId)) {
    return 0;
  }
  if (isRegularSocio(userId, membershipType, adminId, activeSocioUserIds)) {
    return 1;
  }
  return 2;
}

export function compareArrivalParticipants(
  a: EventRegistrationListItem,
  b: EventRegistrationListItem,
  adminId: string,
  activeSocioUserIds: ReadonlySet<string>
): number {
  const tierA = getArrivalPriorityTier(
    a.userId,
    a.membershipType,
    adminId,
    activeSocioUserIds
  );
  const tierB = getArrivalPriorityTier(
    b.userId,
    b.membershipType,
    adminId,
    activeSocioUserIds
  );
  if (tierA !== tierB) {
    return tierA - tierB;
  }

  const aArrived = a.arrivedAt?.getTime() ?? 0;
  const bArrived = b.arrivedAt?.getTime() ?? 0;
  if (aArrived !== bArrived) {
    return aArrived - bArrived;
  }

  return a.apelido.localeCompare(b.apelido, 'pt-BR');
}

export function formatEffectiveMembershipLabel(
  userId: string,
  membershipType: MembershipType,
  adminId: string,
  activeSocioUserIds: ReadonlySet<string>
): string {
  if (isEventAdmin(userId, adminId)) {
    return 'Administrador';
  }
  if (isRegularSocio(userId, membershipType, adminId, activeSocioUserIds)) {
    return 'Socio';
  }
  return 'Convidado';
}

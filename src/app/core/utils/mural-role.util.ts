import { MuralTargetRole } from '../models/event-performance.model';
import { ProfileRole } from '../models/profile-role.model';

export function isGoalkeeperPosition(position?: string | null): boolean {
  return (position ?? '').trim().toLowerCase() === 'goleiro';
}

export function profileRoleToMuralRole(role: ProfileRole): MuralTargetRole | null {
  switch (role) {
    case 'athlete':
      return 'athlete';
    case 'referee':
      return 'referee';
    case 'scout':
      return 'scout';
    case 'journalist':
      return 'journalist';
    case 'cameraman':
      return 'cameraman';
    case 'narrator':
      return 'narrator';
    case 'coach':
      return 'coach';
    case 'physical_trainer':
      return 'physical_trainer';
    case 'masseur':
      return 'masseur';
    case 'kitman':
      return 'kitman';
    case 'gandula':
      return 'gandula';
    case 'fan':
      return null;
    default:
      return null;
  }
}

/** Role de mural ao votar em inscricao de evento (goleiros usam categoria goalkeeper). */
export function eventRegistrationVoteMuralRole(
  role: ProfileRole | string,
  primaryPosition?: string | null
): MuralTargetRole | null {
  if (role === 'goalkeeper') {
    return 'goalkeeper';
  }
  if (role === 'athlete') {
    return isGoalkeeperPosition(primaryPosition) ? 'goalkeeper' : 'athlete';
  }
  return profileRoleToMuralRole(role as ProfileRole);
}

/** Votos legados de atletas-goleiros eram salvos como athlete; reclassifica para goalkeeper. */
export function normalizeVoteTargetRole(
  targetUserId: string,
  targetRole: MuralTargetRole,
  goalkeeperUserIds: Set<string>
): MuralTargetRole {
  if (targetRole === 'athlete' && goalkeeperUserIds.has(targetUserId)) {
    return 'goalkeeper';
  }
  return targetRole;
}

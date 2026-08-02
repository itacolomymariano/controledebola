import { ProfileRole } from './profile-role.model';
import { MuralTargetRole } from './event-performance.model';
import { Address } from './address.model';

export interface PeladaParticipant {
  userId: string;
  userName: string;
  apelido: string;
  fullName?: string;
  roles: ProfileRole[];
  avatarUrl?: string;
  birthDate?: Date;
  address?: Address;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
  profileLabel?: string;
  favoriteProTeam?: string;
  favoriteAmateurTeam?: string;
}

export function registrationRolesForMuralRole(role: MuralTargetRole): ProfileRole[] {
  switch (role) {
    case 'athlete':
    case 'goalkeeper':
      return ['athlete'];
    case 'referee':
      return ['referee'];
    case 'scout':
      return ['scout'];
    case 'journalist':
      return ['journalist'];
    case 'cameraman':
      return ['cameraman'];
    case 'narrator':
      return ['narrator'];
    case 'coach':
      return ['coach'];
    case 'physical_trainer':
      return ['physical_trainer'];
    case 'masseur':
      return ['masseur'];
    case 'kitman':
      return ['kitman'];
    case 'gandula':
      return ['gandula'];
    default:
      return [];
  }
}

export function filterParticipantsByMuralRole(
  participants: PeladaParticipant[],
  role: MuralTargetRole
): PeladaParticipant[] {
  const allowed = new Set(registrationRolesForMuralRole(role));
  return participants.filter((p) => p.roles.some((r) => allowed.has(r)));
}

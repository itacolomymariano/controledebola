import { EventType } from './event.model';
import { PROFILE_ROLE_LABELS, ProfileRole } from './profile-role.model';
import { ProfessionalRole, PROFESSIONAL_ROLES } from './role-profile.model';

export type HireableRole = ProfessionalRole | 'fan' | 'athlete';

export const HIREABLE_ROLES: HireableRole[] = ['athlete', ...PROFESSIONAL_ROLES, 'fan'];

export type AttendanceMode = 'in_person' | 'remote';

export interface EventInviteCandidate {
  userId: string;
  userName: string;
  apelido: string;
  fullName?: string;
  avatarUrl?: string;
  city?: string;
  state?: string;
  proximityScore?: number;
  peladaRate?: number;
  matchRate?: number;
  athleteRate?: number;
  peladaLiveRate?: number;
  matchLiveRate?: number;
  peladaHighlightEditRate?: number;
  matchHighlightEditRate?: number;
  peladaGoalNarrationEditRate?: number;
  matchGoalNarrationEditRate?: number;
  teamTrainingRate?: number;
  teamRate?: number;
  peladaPresentialRate?: number;
  peladaRemoteRate?: number;
  matchPresentialRate?: number;
  matchRemoteRate?: number;
}

export function hireableRoleLabel(role: HireableRole): string {
  return PROFILE_ROLE_LABELS[role as ProfileRole];
}

export function suggestOfferAmount(
  role: HireableRole,
  eventType: EventType,
  attendanceMode: AttendanceMode,
  candidate: EventInviteCandidate
): number | null {
  const isMatch = eventType === 'team_match';

  if (role === 'fan') {
    if (isMatch) {
      return attendanceMode === 'remote'
        ? candidate.matchRemoteRate ?? null
        : candidate.matchPresentialRate ?? null;
    }
    return attendanceMode === 'remote'
      ? candidate.peladaRemoteRate ?? null
      : candidate.peladaPresentialRate ?? null;
  }

  if (role === 'athlete') {
    return isMatch ? candidate.matchRate ?? null : candidate.peladaRate ?? null;
  }

  if (role === 'referee' || role === 'scout' || role === 'journalist' || role === 'masseur' || role === 'kitman' || role === 'gandula') {
    return isMatch ? candidate.matchRate ?? null : candidate.peladaRate ?? null;
  }

  if (role === 'cameraman' || role === 'narrator') {
    return isMatch ? candidate.matchLiveRate ?? null : candidate.peladaLiveRate ?? null;
  }

  if (role === 'coach') {
    return candidate.teamTrainingRate ?? null;
  }

  if (role === 'physical_trainer') {
    return candidate.teamTrainingRate ?? candidate.athleteRate ?? null;
  }

  return null;
}

export function formatCandidateRates(
  role: HireableRole,
  candidate: EventInviteCandidate,
  formatMoney: (value: number) => string
): string {
  const parts: string[] = [];
  const push = (label: string, value?: number) => {
    if (value != null && !Number.isNaN(value)) parts.push(`${label} ${formatMoney(value)}`);
  };

  if (role === 'fan') {
    push('Pelada pres.', candidate.peladaPresentialRate);
    push('Pelada rem.', candidate.peladaRemoteRate);
    push('Partida pres.', candidate.matchPresentialRate);
    push('Partida rem.', candidate.matchRemoteRate);
  } else if (role === 'athlete') {
    push('Pelada', candidate.peladaRate);
    push('Partida', candidate.matchRate);
  } else if (role === 'cameraman' || role === 'narrator') {
    push('Pelada ao vivo', candidate.peladaLiveRate);
    push('Partida ao vivo', candidate.matchLiveRate);
  } else if (role === 'coach') {
    push('Treino/time', candidate.teamTrainingRate);
  } else if (role === 'physical_trainer') {
    push('Equipe', candidate.teamTrainingRate);
    push('Personal', candidate.athleteRate);
  } else {
    push('Pelada', candidate.peladaRate);
    push('Partida', candidate.matchRate);
    if (role === 'scout') push('Atleta', candidate.athleteRate);
    if (role === 'masseur' || role === 'kitman') push('Time', candidate.teamRate);
  }

  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

export function inviteeRoleLabel(role: HireableRole): string {
  switch (role) {
    case 'referee':
      return 'arbitro';
    case 'fan':
      return 'torcedor';
    case 'athlete':
      return 'atleta';
    default:
      return hireableRoleLabel(role).toLowerCase();
  }
}

export function remotePresenceRoles(): ProfileRole[] {
  return ['cameraman', 'narrator'];
}

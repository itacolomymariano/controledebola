import { PROFILE_ROLE_LABELS, ProfileRole } from './profile-role.model';
import { RoleParticipationHistory } from './role-participation-history.model';
import { RoleProfile } from './role-profile.model';

export const SEARCHABLE_PROFILE_ROLES: ProfileRole[] = [
  'athlete',
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
  'gatekeeper',
  'fan',
];

export const SEARCHABLE_PROFILE_OPTIONS = SEARCHABLE_PROFILE_ROLES.map((role) => ({
  role,
  label: PROFILE_ROLE_LABELS[role],
}));

export type SearchProfileKind = ProfileRole | 'legend_athlete' | 'legend_team';

export const LEGEND_SEARCH_OPTIONS: Array<{ role: SearchProfileKind; label: string }> = [
  { role: 'legend_athlete', label: 'Atletas Lendas' },
  { role: 'legend_team', label: 'Times Lendas' },
];

export const ALL_SEARCH_PROFILE_OPTIONS: Array<{ role: SearchProfileKind; label: string }> = [
  ...SEARCHABLE_PROFILE_OPTIONS,
  ...LEGEND_SEARCH_OPTIONS,
];

export function isLegendSearchKind(role: SearchProfileKind): role is 'legend_athlete' | 'legend_team' {
  return role === 'legend_athlete' || role === 'legend_team';
}

export interface ProfileSearchResult {
  userId: string;
  displayName: string;
  apelido?: string;
  fullName?: string;
  role: ProfileRole;
  subtitle?: string;
  city?: string;
  state?: string;
  avatarUrl?: string;
}

export interface RolePublicProfile {
  userId: string;
  role: ProfileRole;
  displayName: string;
  apelido?: string;
  fullName?: string;
  avatarUrl?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  age?: number;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
  favoriteProTeam?: string;
  roleProfile?: RoleProfile;
  history: RoleParticipationHistory;
}

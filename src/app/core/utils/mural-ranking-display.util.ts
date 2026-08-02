import { MuralTargetRole } from '../models/event-performance.model';
import { MuralRankingEntry } from '../models/mural.model';
import { muralRankingBadgeLabel } from './mural-ranking.util';

export interface MuralRankingDisplayRow {
  userId: string;
  userName: string;
  avatarUrl?: string;
  badgeLabel: string;
}

export interface MuralRankingDisplaySection {
  role: MuralTargetRole;
  title: string;
  entries: MuralRankingDisplayRow[];
}

export function buildMuralRankingDisplaySections(
  roles: MuralTargetRole[],
  rankings: Record<MuralTargetRole, MuralRankingEntry[]>,
  roleTitle: (role: MuralTargetRole) => string
): MuralRankingDisplaySection[] {
  return roles.map((role) => ({
    role,
    title: roleTitle(role),
    entries: (rankings[role] ?? []).map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      avatarUrl: entry.avatarUrl,
      badgeLabel: muralRankingBadgeLabel(role, entry),
    })),
  }));
}

import { MuralRankingEntry } from '../models/mural.model';
import { MuralTargetRole } from '../models/event-performance.model';

export function muralRankingDisplayScore(entry: MuralRankingEntry): number {
  if (entry.voteCount > 0) {
    return entry.totalScore;
  }
  return entry.combinedScore;
}

export function muralRankingBadgeLabel(
  role: MuralTargetRole,
  entry: MuralRankingEntry
): string {
  const supportRoles: MuralTargetRole[] = [
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
  ];
  if (supportRoles.includes(role) && entry.voteCount > 0) {
    const avg = Number(entry.averageScore ?? entry.totalScore) || 0;
    return `${avg.toFixed(1)} med`;
  }
  if (entry.voteCount > 0) {
    if (role === 'goalkeeper') {
      return `${entry.totalScore.toFixed(1)} pts`;
    }
    return `${entry.totalScore.toFixed(1)}`;
  }
  const score = muralRankingDisplayScore(entry);
  return `${score.toFixed(1)}`;
}

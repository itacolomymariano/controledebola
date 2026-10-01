import { MuralRankingEntry } from '../models/mural.model';
import { MuralTargetRole } from '../models/event-performance.model';

export function muralRankingDisplayScore(entry: MuralRankingEntry): number {
  if (entry.voteCount > 0) {
    return entry.totalScore;
  }
  return entry.combinedScore;
}

/** Mesma métrica da badge do Top 10 Atletas (nota média quando há votos). */
export function athleteRankingDisplayNote(entry: MuralRankingEntry): number {
  if (entry.voteCount > 0) {
    return Number(entry.averageScore ?? 0) || 0;
  }
  return Number(entry.combinedScore ?? 0) || 0;
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
    'fan',
    'gatekeeper',
  ];
  if (entry.voteCount > 0) {
    const avg = Number(entry.averageScore ?? entry.totalScore) || 0;
    if (supportRoles.includes(role) || role === 'athlete' || role === 'goalkeeper') {
      return avg.toFixed(1);
    }
  }
  const score = muralRankingDisplayScore(entry);
  return score.toFixed(1);
}

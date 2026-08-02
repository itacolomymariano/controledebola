import { MuralTargetRole } from './event-performance.model';
import { MuralRankingEntry } from './mural.model';

export interface MuralLocationTopGroup {
  label: string;
  participantCount: number;
  rankings: Record<MuralTargetRole, MuralRankingEntry[]>;
}

export interface MuralLocationTopRankings {
  byState: MuralLocationTopGroup[];
  byCity: MuralLocationTopGroup[];
  byNeighborhood: MuralLocationTopGroup[];
}

export function emptyMuralLocationTopRankings(): MuralLocationTopRankings {
  return {
    byState: [],
    byCity: [],
    byNeighborhood: [],
  };
}

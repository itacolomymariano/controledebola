import { MuralScope } from './mural.model';

export interface MuralLocationCount {
  label: string;
  count: number;
}

export interface MuralParticipantLocationStats {
  total: number;
  byState: MuralLocationCount[];
  byCity: MuralLocationCount[];
  byNeighborhood: MuralLocationCount[];
}

export type MuralParticipantStatsScope = MuralScope;

export function emptyMuralParticipantLocationStats(): MuralParticipantLocationStats {
  return {
    total: 0,
    byState: [],
    byCity: [],
    byNeighborhood: [],
  };
}

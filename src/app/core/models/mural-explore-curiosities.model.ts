import { MuralShowcaseEntry } from './mural-highlights.model';

export interface MuralExploreAthleteMapTopState {
  uf: string;
  count: number;
}

export interface MuralExploreAthleteMapTopCity {
  uf: string;
  city: string;
  count: number;
}

export interface MuralExploreAthleteMapTopNeighborhood {
  uf: string;
  city: string;
  neighborhood: string;
  count: number;
}

export interface MuralExploreGoalDetails {
  rightFoot: MuralShowcaseEntry | null;
  leftFoot: MuralShowcaseEntry | null;
  header: MuralShowcaseEntry | null;
  freeKick: MuralShowcaseEntry | null;
  penalty: MuralShowcaseEntry | null;
  penaltySaver: MuralShowcaseEntry | null;
}

export interface MuralExploreCuriosities {
  goalDetails: MuralExploreGoalDetails;
  craqueMaster: MuralShowcaseEntry | null;
  craquePromessa: MuralShowcaseEntry | null;
  goleiroMaster: MuralShowcaseEntry | null;
  goleiroPromessa: MuralShowcaseEntry | null;
  tallest: MuralShowcaseEntry | null;
  shortest: MuralShowcaseEntry | null;
  athleteMap: {
    topState: MuralExploreAthleteMapTopState | null;
    topCity: MuralExploreAthleteMapTopCity | null;
    topNeighborhood: MuralExploreAthleteMapTopNeighborhood | null;
  };
}

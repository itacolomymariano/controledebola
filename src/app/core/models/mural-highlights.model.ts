export type MuralAgeBand = 'sub30' | 'sub60' | 'plus60';

export const MURAL_AGE_BAND_LABELS: Record<MuralAgeBand, string> = {
  sub30: 'Sub 30',
  sub60: 'Sub 60',
  plus60: '60+',
};

export interface MuralShowcaseEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  profileLabel: string;
  favoriteProTeam?: string;
  favoriteAmateurTeam?: string;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
  score?: number;
  scoreLabel?: string;
  age?: number;
}

export interface MuralBirthdayEntry extends MuralShowcaseEntry {
  birthdayDay: number;
}

export interface MuralAgeBandWinners {
  sub30: MuralShowcaseEntry | null;
  sub60: MuralShowcaseEntry | null;
  plus60: MuralShowcaseEntry | null;
}

export interface MuralFavoriteTeamEntry {
  teamName: string;
  count: number;
}

export interface MuralHighlights {
  craque: MuralAgeBandWinners;
  goleador: MuralAgeBandWinners;
  goleadorOverall?: MuralShowcaseEntry | null;
  melhorGoleiro: MuralAgeBandWinners;
  timeMaisAmado?: MuralFavoriteTeamEntry | null;
  promessa: MuralShowcaseEntry | null;
  master: MuralShowcaseEntry | null;
  birthdays: MuralBirthdayEntry[];
  melhorJuiz: MuralShowcaseEntry | null;
}

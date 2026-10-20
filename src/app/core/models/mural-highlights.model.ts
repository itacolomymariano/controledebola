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
  /** Ex.: "Há: 3 dia(s)" — mural App por aba. */
  tenureLabel?: string;
  /** Ex.: "12 pessoas avaliaram" — mural geral. */
  evaluatorCountLabel?: string;
}

export interface MuralBirthdayEntry extends MuralShowcaseEntry {
  birthdayDay: number;
}

export interface MuralAgeBandWinners {
  sub30: MuralShowcaseEntry | null;
  sub60: MuralShowcaseEntry | null;
  plus60: MuralShowcaseEntry | null;
}

/** Goleador: lista por faixa (empate = varios cards). */
export interface MuralAgeBandWinnerLists {
  sub30: MuralShowcaseEntry[];
  sub60: MuralShowcaseEntry[];
  plus60: MuralShowcaseEntry[];
}

export interface MuralFavoriteTeamEntry {
  teamName: string;
  count: number;
  tenureLabel?: string;
}

export interface MuralHighlights {
  craque: MuralAgeBandWinners;
  craquePelada?: MuralShowcaseEntry | null;
  craqueConfronto?: MuralShowcaseEntry | null;
  goleador: MuralAgeBandWinnerLists;
  goleadorOverall?: MuralShowcaseEntry[];
  goleadorPelada?: MuralShowcaseEntry[];
  goleadorConfronto?: MuralShowcaseEntry[];
  melhorGoleiro: MuralAgeBandWinners;
  melhorGoleiroPelada?: MuralShowcaseEntry | null;
  melhorGoleiroConfronto?: MuralShowcaseEntry | null;
  timeMaisAmado?: MuralFavoriteTeamEntry | null;
  timeAmadorMaisAmado?: MuralFavoriteTeamEntry | null;
  atletaMaisAlto?: MuralShowcaseEntry | null;
  atletaMaisBaixo?: MuralShowcaseEntry | null;
  promessa: MuralShowcaseEntry | null;
  master: MuralShowcaseEntry | null;
  birthdays: MuralBirthdayEntry[];
  melhorJuiz: MuralShowcaseEntry | null;
}

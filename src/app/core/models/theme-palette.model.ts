export const THEME_PALETTE_IDS = [
  'default',
  'red_black_yellow',
  'red_black_white',
  'black_white',
  'green_white',
  'red_white',
  'blue_black_white',
  'blue_white',
  'yellow_black',
  'blue_red_white',
] as const;

export type ThemePaletteId = (typeof THEME_PALETTE_IDS)[number];

export const DEFAULT_THEME_PALETTE: ThemePaletteId = 'default';

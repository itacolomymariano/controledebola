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

export const THEME_SURFACE_IDS = ['dark', 'light'] as const;
export type ThemeSurfaceId = (typeof THEME_SURFACE_IDS)[number];
export const DEFAULT_THEME_SURFACE: ThemeSurfaceId = 'dark';

export interface ThemeLightSurface {
  page: string;
  pageRgb: string;
  toolbar: string;
  item: string;
  card: string;
  text: string;
}

/** Papel claro tingido pela paleta. Hex apenas neste arquivo. */
export const THEME_LIGHT_SURFACES: Record<ThemePaletteId, ThemeLightSurface> = {
  default: {
    page: '#f4f6fb',
    pageRgb: '244, 246, 251',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  red_black_yellow: {
    page: '#faf4f4',
    pageRgb: '250, 244, 244',
    toolbar: '#fff8e6',
    item: '#ffffff',
    card: '#fffdf6',
    text: '#1a1a1a',
  },
  red_black_white: {
    page: '#faf4f5',
    pageRgb: '250, 244, 245',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  black_white: {
    page: '#f2f2f2',
    pageRgb: '242, 242, 242',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#111111',
  },
  green_white: {
    page: '#f3faf5',
    pageRgb: '243, 250, 245',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#143d22',
  },
  red_white: {
    page: '#faf4f5',
    pageRgb: '250, 244, 245',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  blue_black_white: {
    page: '#f3f6fc',
    pageRgb: '243, 246, 252',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  blue_white: {
    page: '#f3f6fc',
    pageRgb: '243, 246, 252',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  yellow_black: {
    page: '#faf7e8',
    pageRgb: '250, 247, 232',
    toolbar: '#fff8d6',
    item: '#ffffff',
    card: '#fffbeb',
    text: '#1a1a1a',
  },
  blue_red_white: {
    page: '#f4f6fb',
    pageRgb: '244, 246, 251',
    toolbar: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
};

/** Faixas visuais das paletas. Hex apenas neste arquivo. */
export const THEME_PALETTE_SWATCHES: Record<ThemePaletteId, readonly string[]> = {
  default: ['#0054e9', '#0163aa', '#6030ff'],
  red_black_yellow: ['#c8102e', '#111111', '#ffd100'],
  red_black_white: ['#c8102e', '#111111', '#ffffff'],
  black_white: ['#111111', '#4d4d4d', '#ffffff'],
  green_white: ['#1b7a3d', '#186b36', '#ffffff'],
  red_white: ['#c8102e', '#b00e28', '#ffffff'],
  blue_black_white: ['#0054e9', '#111111', '#ffffff'],
  blue_white: ['#0054e9', '#004acd', '#ffffff'],
  yellow_black: ['#f5c400', '#111111', '#f5c400'],
  blue_red_white: ['#0054e9', '#c8102e', '#ffffff'],
};

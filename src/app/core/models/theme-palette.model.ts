export const THEME_PALETTE_IDS = [
  'controle_de_bola',
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

export const DEFAULT_THEME_PALETTE: ThemePaletteId = 'controle_de_bola';

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
export interface ThemeDarkSurface {
  page: string;
  pageRgb: string;
  toolbar: string;
  item: string;
  card: string;
  text: string;
}

export const THEME_LIGHT_SURFACES: Record<ThemePaletteId, ThemeLightSurface> = {
  controle_de_bola: {
    page: '#eef8f1',
    pageRgb: '238, 248, 241',
    toolbar: '#1d7a3e',
    item: '#ffffff',
    card: '#ffffff',
    text: '#143d22',
  },
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
export const THEME_DARK_SURFACES: Record<ThemePaletteId, ThemeDarkSurface> = {
  controle_de_bola: {
    page: '#0c1810',
    pageRgb: '12, 24, 16',
    toolbar: '#143522',
    item: '#1a2e20',
    card: '#1a2e20',
    text: '#eef8f1',
  },
  default: {
    page: '#121212',
    pageRgb: '18, 18, 18',
    toolbar: '#1f1f1f',
    item: '#1e1e1e',
    card: '#1e1e1e',
    text: '#f4f4f5',
  },
  red_black_yellow: {
    page: '#141010',
    pageRgb: '20, 16, 16',
    toolbar: '#1a1010',
    item: '#221818',
    card: '#221818',
    text: '#faf4f4',
  },
  red_black_white: {
    page: '#141010',
    pageRgb: '20, 16, 16',
    toolbar: '#1a1010',
    item: '#221818',
    card: '#221818',
    text: '#faf4f5',
  },
  black_white: {
    page: '#0f0f0f',
    pageRgb: '15, 15, 15',
    toolbar: '#1a1a1a',
    item: '#1e1e1e',
    card: '#1e1e1e',
    text: '#f2f2f2',
  },
  green_white: {
    page: '#0c1810',
    pageRgb: '12, 24, 16',
    toolbar: '#143522',
    item: '#1a2e20',
    card: '#1a2e20',
    text: '#eef8f1',
  },
  red_white: {
    page: '#141010',
    pageRgb: '20, 16, 16',
    toolbar: '#241418',
    item: '#221818',
    card: '#221818',
    text: '#faf4f5',
  },
  blue_black_white: {
    page: '#0e1218',
    pageRgb: '14, 18, 24',
    toolbar: '#151c28',
    item: '#1a2230',
    card: '#1a2230',
    text: '#f3f6fc',
  },
  blue_white: {
    page: '#0e1218',
    pageRgb: '14, 18, 24',
    toolbar: '#151c28',
    item: '#1a2230',
    card: '#1a2230',
    text: '#f3f6fc',
  },
  yellow_black: {
    page: '#12100a',
    pageRgb: '18, 16, 10',
    toolbar: '#1a1608',
    item: '#221e10',
    card: '#221e10',
    text: '#faf7e8',
  },
  blue_red_white: {
    page: '#0e1218',
    pageRgb: '14, 18, 24',
    toolbar: '#151c28',
    item: '#1a2230',
    card: '#1a2230',
    text: '#f4f6fb',
  },
};

export const THEME_PALETTE_SWATCHES: Record<ThemePaletteId, readonly string[]> = {
  controle_de_bola: ['#1d7a3e', '#f5c400', '#ffffff'],
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

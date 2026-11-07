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
  /** Texto/icones sobre a toolbar e tab bar (contraste com `toolbar`). */
  toolbarText: string;
  item: string;
  card: string;
  text: string;
}

/** Papel claro tingido pela paleta. Hex apenas neste arquivo. */
export interface ThemeDarkSurface {
  page: string;
  pageRgb: string;
  toolbar: string;
  toolbarText: string;
  item: string;
  card: string;
  text: string;
}

/** Home hub (/tabs/home): fundo da pagina + gradiente do hero — hex apenas aqui. */
export interface ThemeHomeHubSurface {
  pageBg: string;
  heroStart: string;
  heroEnd: string;
  heroText: string;
  heroChipBg: string;
}

export const THEME_HOME_HUB_LIGHT: Record<ThemePaletteId, ThemeHomeHubSurface> = {
  controle_de_bola: {
    pageBg: '#f3f0fa',
    heroStart: '#5b21b6',
    heroEnd: '#7c3aed',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
  default: {
    pageBg: '#f1f3fb',
    heroStart: '#4f46e5',
    heroEnd: '#7c3aed',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
  red_black_yellow: {
    pageBg: '#faf6f2',
    heroStart: '#b91c1c',
    heroEnd: '#c8102e',
    heroText: '#fffdf6',
    heroChipBg: 'rgba(255, 255, 250, 0.2)',
  },
  red_black_white: {
    pageBg: '#faf4f5',
    heroStart: '#9f1239',
    heroEnd: '#c8102e',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
  black_white: {
    pageBg: '#f3f3f3',
    heroStart: '#171717',
    heroEnd: '#404040',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.18)',
  },
  green_white: {
    pageBg: '#eef8f1',
    heroStart: '#14532d',
    heroEnd: '#1b7a3d',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
  red_white: {
    pageBg: '#faf4f5',
    heroStart: '#9f1239',
    heroEnd: '#c8102e',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
  blue_black_white: {
    pageBg: '#f0f4fb',
    heroStart: '#1d4ed8',
    heroEnd: '#0054e9',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
  blue_white: {
    pageBg: '#f0f4fb',
    heroStart: '#1d4ed8',
    heroEnd: '#2563eb',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
  yellow_black: {
    pageBg: '#faf8ee',
    heroStart: '#ca8a04',
    heroEnd: '#eab308',
    heroText: '#1a1a1a',
    heroChipBg: 'rgba(17, 17, 17, 0.12)',
  },
  blue_red_white: {
    pageBg: '#f0f4fb',
    heroStart: '#1d4ed8',
    heroEnd: '#c8102e',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.22)',
  },
};

export const THEME_HOME_HUB_DARK: Record<ThemePaletteId, ThemeHomeHubSurface> = {
  controle_de_bola: {
    pageBg: '#1a1528',
    heroStart: '#4c1d95',
    heroEnd: '#6d28d9',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.18)',
  },
  default: {
    pageBg: '#161525',
    heroStart: '#4338ca',
    heroEnd: '#5b21b6',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.18)',
  },
  red_black_yellow: {
    pageBg: '#1c1010',
    heroStart: '#991b1b',
    heroEnd: '#c8102e',
    heroText: '#fffdf6',
    heroChipBg: 'rgba(255, 209, 0, 0.15)',
  },
  red_black_white: {
    pageBg: '#1a1012',
    heroStart: '#9f1239',
    heroEnd: '#c8102e',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.16)',
  },
  black_white: {
    pageBg: '#141414',
    heroStart: '#262626',
    heroEnd: '#404040',
    heroText: '#f5f5f5',
    heroChipBg: 'rgba(255, 255, 255, 0.12)',
  },
  green_white: {
    pageBg: '#0f1a14',
    heroStart: '#14532d',
    heroEnd: '#15803d',
    heroText: '#ecfdf5',
    heroChipBg: 'rgba(255, 255, 255, 0.16)',
  },
  red_white: {
    pageBg: '#1a1012',
    heroStart: '#9f1239',
    heroEnd: '#c8102e',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.16)',
  },
  blue_black_white: {
    pageBg: '#0e1420',
    heroStart: '#1e40af',
    heroEnd: '#1d4ed8',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.18)',
  },
  blue_white: {
    pageBg: '#0e1420',
    heroStart: '#1d4ed8',
    heroEnd: '#2563eb',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.18)',
  },
  yellow_black: {
    pageBg: '#14120c',
    heroStart: '#a16207',
    heroEnd: '#ca8a04',
    heroText: '#111111',
    heroChipBg: 'rgba(17, 17, 17, 0.2)',
  },
  blue_red_white: {
    pageBg: '#12141c',
    heroStart: '#1d4ed8',
    heroEnd: '#b91c1c',
    heroText: '#ffffff',
    heroChipBg: 'rgba(255, 255, 255, 0.18)',
  },
};

export const THEME_LIGHT_SURFACES: Record<ThemePaletteId, ThemeLightSurface> = {
  controle_de_bola: {
    page: '#f3f0fa',
    pageRgb: '243, 240, 250',
    toolbar: '#5b21b6',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1e1633',
  },
  default: {
    page: '#f4f6fb',
    pageRgb: '244, 246, 251',
    toolbar: '#0054e9',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  red_black_yellow: {
    page: '#faf4f4',
    pageRgb: '250, 244, 244',
    toolbar: '#c8102e',
    toolbarText: '#ffd100',
    item: '#ffffff',
    card: '#fffdf6',
    text: '#1a1a1a',
  },
  red_black_white: {
    page: '#faf4f5',
    pageRgb: '250, 244, 245',
    toolbar: '#c8102e',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  black_white: {
    page: '#f2f2f2',
    pageRgb: '242, 242, 242',
    toolbar: '#111111',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#111111',
  },
  green_white: {
    page: '#f3faf5',
    pageRgb: '243, 250, 245',
    toolbar: '#1b7a3d',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#143d22',
  },
  red_white: {
    page: '#faf4f5',
    pageRgb: '250, 244, 245',
    toolbar: '#c8102e',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  blue_black_white: {
    page: '#f3f6fc',
    pageRgb: '243, 246, 252',
    toolbar: '#0054e9',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  blue_white: {
    page: '#f3f6fc',
    pageRgb: '243, 246, 252',
    toolbar: '#0054e9',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
  yellow_black: {
    page: '#faf7e8',
    pageRgb: '250, 247, 232',
    toolbar: '#f5c400',
    toolbarText: '#111111',
    item: '#ffffff',
    card: '#fffbeb',
    text: '#1a1a1a',
  },
  blue_red_white: {
    page: '#f4f6fb',
    pageRgb: '244, 246, 251',
    toolbar: '#0054e9',
    toolbarText: '#ffffff',
    item: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
  },
};

/** Faixas visuais das paletas. Hex apenas neste arquivo. */
export const THEME_DARK_SURFACES: Record<ThemePaletteId, ThemeDarkSurface> = {
  controle_de_bola: {
    page: '#1a1528',
    pageRgb: '26, 21, 40',
    toolbar: '#4c1d95',
    toolbarText: '#ffffff',
    item: '#2a2438',
    card: '#2a2438',
    text: '#eef8f1',
  },
  default: {
    page: '#121212',
    pageRgb: '18, 18, 18',
    toolbar: '#1e3a8a',
    toolbarText: '#f4f4f5',
    item: '#1e1e1e',
    card: '#1e1e1e',
    text: '#f4f4f5',
  },
  red_black_yellow: {
    page: '#141010',
    pageRgb: '20, 16, 16',
    toolbar: '#7f1d1d',
    toolbarText: '#ffd100',
    item: '#221818',
    card: '#221818',
    text: '#faf4f4',
  },
  red_black_white: {
    page: '#141010',
    pageRgb: '20, 16, 16',
    toolbar: '#881337',
    toolbarText: '#ffffff',
    item: '#221818',
    card: '#221818',
    text: '#faf4f5',
  },
  black_white: {
    page: '#0f0f0f',
    pageRgb: '15, 15, 15',
    toolbar: '#262626',
    toolbarText: '#f5f5f5',
    item: '#1e1e1e',
    card: '#1e1e1e',
    text: '#f2f2f2',
  },
  green_white: {
    page: '#0c1810',
    pageRgb: '12, 24, 16',
    toolbar: '#14532d',
    toolbarText: '#ecfdf5',
    item: '#1a2e20',
    card: '#1a2e20',
    text: '#eef8f1',
  },
  red_white: {
    page: '#141010',
    pageRgb: '20, 16, 16',
    toolbar: '#881337',
    toolbarText: '#ffffff',
    item: '#221818',
    card: '#221818',
    text: '#faf4f5',
  },
  blue_black_white: {
    page: '#0e1218',
    pageRgb: '14, 18, 24',
    toolbar: '#1e3a8a',
    toolbarText: '#f3f6fc',
    item: '#1a2230',
    card: '#1a2230',
    text: '#f3f6fc',
  },
  blue_white: {
    page: '#0e1218',
    pageRgb: '14, 18, 24',
    toolbar: '#1d4ed8',
    toolbarText: '#ffffff',
    item: '#1a2230',
    card: '#1a2230',
    text: '#f3f6fc',
  },
  yellow_black: {
    page: '#12100a',
    pageRgb: '18, 16, 10',
    toolbar: '#a16207',
    toolbarText: '#111111',
    item: '#221e10',
    card: '#221e10',
    text: '#faf7e8',
  },
  blue_red_white: {
    page: '#0e1218',
    pageRgb: '14, 18, 24',
    toolbar: '#1e3a8a',
    toolbarText: '#ffffff',
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

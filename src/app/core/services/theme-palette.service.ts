import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppStorageService } from './app-storage.service';
import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SURFACE,
  THEME_DARK_SURFACES,
  THEME_HOME_HUB_DARK,
  THEME_HOME_HUB_LIGHT,
  THEME_LIGHT_SURFACES,
  THEME_PALETTE_IDS,
  ThemePaletteId,
  ThemeSurfaceId,
} from '../models/theme-palette.model';
import {
  THEME_PLAYFUL_DARK,
  THEME_PLAYFUL_DOOR_DARK,
  THEME_PLAYFUL_DOOR_LIGHT,
  THEME_PLAYFUL_LIGHT,
} from '../models/theme-playful.model';

const PALETTE_LABEL_KEYS: Record<ThemePaletteId, string> = {
  controle_de_bola: 'palette.controleDeBola',
  default: 'palette.default',
  red_black_yellow: 'palette.redBlackYellow',
  red_black_white: 'palette.redBlackWhite',
  black_white: 'palette.blackWhite',
  green_white: 'palette.greenWhite',
  red_white: 'palette.redWhite',
  blue_black_white: 'palette.blueBlackWhite',
  blue_white: 'palette.blueWhite',
  yellow_black: 'palette.yellowBlack',
  blue_red_white: 'palette.blueRedWhite',
};

@Injectable({ providedIn: 'root' })
export class ThemePaletteService {
  readonly ids = THEME_PALETTE_IDS;
  readonly labelKeys = PALETTE_LABEL_KEYS;
  readonly current$ = new BehaviorSubject<ThemePaletteId>(DEFAULT_THEME_PALETTE);
  readonly surface$ = new BehaviorSubject<ThemeSurfaceId>(DEFAULT_THEME_SURFACE);
  current: ThemePaletteId = DEFAULT_THEME_PALETTE;
  surface: ThemeSurfaceId = DEFAULT_THEME_SURFACE;

  constructor(private readonly storage: AppStorageService) {}

  async init(): Promise<void> {
    this.current = await this.storage.getPalette();
    this.surface = await this.storage.getSurface();
    this.current$.next(this.current);
    this.surface$.next(this.surface);
    this.apply();
  }

  async setPalette(palette: ThemePaletteId): Promise<void> {
    this.current = palette;
    this.current$.next(palette);
    this.apply();
    await this.storage.setPalette(palette);
  }

  async setSurface(surface: ThemeSurfaceId): Promise<void> {
    this.surface = surface;
    this.surface$.next(surface);
    this.apply();
    await this.storage.setSurface(surface);
  }

  /** Paleta e superfície iniciais (mesmo estado sem preferência salva). */
  async restoreDefaults(): Promise<void> {
    await this.setPalette(DEFAULT_THEME_PALETTE);
    await this.setSurface(DEFAULT_THEME_SURFACE);
  }

  get isDefaultTheme(): boolean {
    return this.current === DEFAULT_THEME_PALETTE && this.surface === DEFAULT_THEME_SURFACE;
  }

  private apply(): void {
    const root = document.documentElement;
    root.setAttribute('data-palette', this.current);
    root.setAttribute('data-surface', this.surface);
    root.classList.toggle('ion-palette-dark', this.surface === 'dark');

    const paper =
      this.surface === 'light'
        ? THEME_LIGHT_SURFACES[this.current]
        : THEME_DARK_SURFACES[this.current];
    root.style.setProperty('--ion-background-color', paper.page);
    root.style.setProperty('--ion-background-color-rgb', paper.pageRgb);
    root.style.setProperty('--ion-toolbar-background', paper.toolbar);
    root.style.setProperty('--ion-toolbar-color', paper.toolbarText);
    root.style.setProperty('--ion-item-background', paper.item);
    root.style.setProperty('--ion-card-background', paper.card);
    root.style.setProperty('--ion-text-color', paper.text);

    const homeHub = this.surface === 'light' ? THEME_HOME_HUB_LIGHT[this.current] : THEME_HOME_HUB_DARK[this.current];
    root.style.setProperty('--cb-home-page-bg', homeHub.pageBg);
    root.style.setProperty('--cb-home-hero-start', homeHub.heroStart);
    root.style.setProperty('--cb-home-hero-end', homeHub.heroEnd);
    root.style.setProperty('--cb-home-hero-text', homeHub.heroText);
    root.style.setProperty('--cb-home-hero-chip-bg', homeHub.heroChipBg);

    const playful = this.surface === 'light' ? THEME_PLAYFUL_LIGHT[this.current] : THEME_PLAYFUL_DARK[this.current];
    root.style.setProperty('--cb-playful-page-bg', playful.page);
    root.style.setProperty('--cb-playful-card-surface', playful.card);
    root.style.setProperty('--cb-playful-card-muted', playful.cardMuted);
    root.style.setProperty('--cb-playful-orb-a', playful.orbA);
    root.style.setProperty('--cb-playful-orb-b', playful.orbB);

    const door = this.surface === 'light' ? THEME_PLAYFUL_DOOR_LIGHT[this.current] : THEME_PLAYFUL_DOOR_DARK[this.current];
    root.style.setProperty('--cb-playful-tone-peladas-bg', door.peladasBg);
    root.style.setProperty('--cb-playful-tone-peladas-fg', door.peladasAccent);
    root.style.setProperty('--cb-playful-tone-confrontos-bg', door.confrontosBg);
    root.style.setProperty('--cb-playful-tone-confrontos-fg', door.confrontosAccent);
    root.style.setProperty('--cb-playful-tone-times-bg', door.timesBg);
    root.style.setProperty('--cb-playful-tone-times-fg', door.timesAccent);
    root.style.setProperty('--cb-playful-tone-users-bg', door.usersBg);
    root.style.setProperty('--cb-playful-tone-users-fg', door.usersAccent);
    root.style.setProperty('--cb-door-peladas-bg', door.peladasBg);
    root.style.setProperty('--cb-door-peladas-accent', door.peladasAccent);
    root.style.setProperty('--cb-door-confrontos-bg', door.confrontosBg);
    root.style.setProperty('--cb-door-confrontos-accent', door.confrontosAccent);
    root.style.setProperty('--cb-door-times-bg', door.timesBg);
    root.style.setProperty('--cb-door-times-accent', door.timesAccent);
    root.style.setProperty('--cb-door-users-bg', door.usersBg);
    root.style.setProperty('--cb-door-users-accent', door.usersAccent);
  }
}

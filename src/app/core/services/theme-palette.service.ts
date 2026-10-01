import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppStorageService } from './app-storage.service';
import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SURFACE,
  THEME_LIGHT_SURFACES,
  THEME_PALETTE_IDS,
  ThemePaletteId,
  ThemeSurfaceId,
} from '../models/theme-palette.model';

const PALETTE_LABEL_KEYS: Record<ThemePaletteId, string> = {
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

const LIGHT_SURFACE_VARS = [
  '--ion-background-color',
  '--ion-background-color-rgb',
  '--ion-toolbar-background',
  '--ion-item-background',
  '--ion-card-background',
  '--ion-text-color',
] as const;

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

  private apply(): void {
    const root = document.documentElement;
    root.setAttribute('data-palette', this.current);
    root.setAttribute('data-surface', this.surface);
    root.classList.toggle('ion-palette-dark', this.surface === 'dark');

    if (this.surface === 'light') {
      const paper = THEME_LIGHT_SURFACES[this.current];
      root.style.setProperty('--ion-background-color', paper.page);
      root.style.setProperty('--ion-background-color-rgb', paper.pageRgb);
      root.style.setProperty('--ion-toolbar-background', paper.toolbar);
      root.style.setProperty('--ion-item-background', paper.item);
      root.style.setProperty('--ion-card-background', paper.card);
      root.style.setProperty('--ion-text-color', paper.text);
      return;
    }

    for (const name of LIGHT_SURFACE_VARS) {
      root.style.removeProperty(name);
    }
  }
}

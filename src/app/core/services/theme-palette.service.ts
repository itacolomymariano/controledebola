import { Injectable } from '@angular/core';
import { AppStorageService } from './app-storage.service';
import {
  DEFAULT_THEME_PALETTE,
  THEME_PALETTE_IDS,
  ThemePaletteId,
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

@Injectable({ providedIn: 'root' })
export class ThemePaletteService {
  readonly ids = THEME_PALETTE_IDS;
  readonly labelKeys = PALETTE_LABEL_KEYS;
  current: ThemePaletteId = DEFAULT_THEME_PALETTE;

  constructor(private readonly storage: AppStorageService) {}

  async init(): Promise<void> {
    this.current = await this.storage.getPalette();
    this.apply(this.current);
  }

  async setPalette(palette: ThemePaletteId): Promise<void> {
    this.current = palette;
    this.apply(palette);
    await this.storage.setPalette(palette);
  }

  private apply(palette: ThemePaletteId): void {
    document.documentElement.setAttribute('data-palette', palette);
  }
}

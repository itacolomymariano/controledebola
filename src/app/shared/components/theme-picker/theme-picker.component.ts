import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import {
  THEME_PALETTE_IDS,
  THEME_PALETTE_SWATCHES,
  THEME_SURFACE_IDS,
  ThemePaletteId,
  ThemeSurfaceId,
} from '../../../core/models/theme-palette.model';
import { I18nService } from '../../../core/services/i18n.service';
import { ThemePaletteService } from '../../../core/services/theme-palette.service';

@Component({
  selector: 'app-theme-picker',
  templateUrl: './theme-picker.component.html',
  styleUrls: ['./theme-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ThemePickerComponent implements OnInit, OnDestroy {
  /** O menu abre a cortina por chamada; o botao fica na ficha do perfil. */
  @Input() showTrigger = true;

  readonly paletteIds = THEME_PALETTE_IDS;
  readonly swatches = THEME_PALETTE_SWATCHES;
  readonly surfaces = THEME_SURFACE_IDS;

  get labelKeys() {
    return this.theme.labelKeys;
  }
  current: ThemePaletteId = 'default';
  surface: ThemeSurfaceId = 'dark';
  curtainOpen = false;

  private paletteSub?: Subscription;
  private surfaceSub?: Subscription;

  constructor(
    readonly theme: ThemePaletteService,
    private readonly i18n: I18nService,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.current = this.theme.current;
    this.surface = this.theme.surface;
    this.paletteSub = this.theme.current$.subscribe((palette) => {
      this.current = palette;
      this.cdr.markForCheck();
    });
    this.surfaceSub = this.theme.surface$.subscribe((surface) => {
      this.surface = surface;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.paletteSub?.unsubscribe();
    this.surfaceSub?.unsubscribe();
  }

  surfaceLabelKey(id: ThemeSurfaceId): string {
    return id === 'dark' ? 'theme.surfaceDark' : 'theme.surfaceLight';
  }

  openCurtain(): void {
    this.curtainOpen = true;
    this.cdr.markForCheck();
  }

  closeCurtain(): void {
    this.curtainOpen = false;
    this.cdr.markForCheck();
  }

  async onSwatchTap(palette: ThemePaletteId): Promise<void> {
    if (palette === this.theme.current) {
      return;
    }

    const confirmed = await this.confirmOverCurtain(
      this.i18n.t('theme.button'),
      this.i18n.t('confirm.theme')
    );
    if (confirmed) {
      await this.applyPalette(palette);
    }
  }

  async onSurfaceTap(surface: ThemeSurfaceId): Promise<void> {
    if (surface === this.theme.surface) {
      return;
    }

    const confirmed = await this.confirmOverCurtain(
      this.i18n.t(this.surfaceLabelKey(surface)),
      this.i18n.t('confirm.surface')
    );
    if (confirmed) {
      await this.applySurface(surface);
    }
  }

  async onRestoreDefaultsTap(): Promise<void> {
    if (this.theme.isDefaultTheme) {
      return;
    }

    const confirmed = await this.confirmOverCurtain(
      this.i18n.t('theme.restoreDefaults'),
      this.i18n.t('confirm.restoreDefaults')
    );
    if (confirmed) {
      await this.applyDefaults();
    }
  }

  private async confirmOverCurtain(header: string, message: string): Promise<boolean> {
    this.closeCurtain();
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        { text: this.i18n.t('confirm.cancel'), role: 'cancel' },
        { text: this.i18n.t('confirm.yes'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      return true;
    }
    this.openCurtain();
    return false;
  }

  private async applyPalette(palette: ThemePaletteId): Promise<void> {
    await this.theme.setPalette(palette);
    this.current = palette;
    this.curtainOpen = false;
    this.cdr.markForCheck();
  }

  private async applySurface(surface: ThemeSurfaceId): Promise<void> {
    await this.theme.setSurface(surface);
    this.surface = surface;
    this.cdr.markForCheck();
  }

  private async applyDefaults(): Promise<void> {
    await this.theme.restoreDefaults();
    this.curtainOpen = false;
    this.cdr.markForCheck();
  }
}

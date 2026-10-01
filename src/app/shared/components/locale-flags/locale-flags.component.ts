import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import {
  APP_LOCALE_FLAGS,
  APP_LOCALE_LABELS,
  APP_LOCALES,
  AppLocale,
} from '../../../core/models/app-locale.model';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-locale-flags',
  templateUrl: './locale-flags.component.html',
  styleUrls: ['./locale-flags.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LocaleFlagsComponent implements OnInit, OnDestroy {
  readonly locales = APP_LOCALES;
  readonly flags = APP_LOCALE_FLAGS;
  readonly labels = APP_LOCALE_LABELS;
  current: AppLocale = 'pt-BR';

  private localeSub?: Subscription;

  constructor(
    private readonly i18n: I18nService,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.current = this.i18n.locale;
    this.localeSub = this.i18n.locale$.subscribe((locale) => {
      this.current = locale;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  async onFlagTap(locale: AppLocale): Promise<void> {
    if (locale === this.i18n.locale) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.i18n.t('profile.language'),
      message: this.i18n.t('confirm.locale', { name: this.labels[locale] }),
      buttons: [
        { text: this.i18n.t('confirm.cancel'), role: 'cancel' },
        {
          text: this.i18n.t('confirm.yes'),
          handler: () => {
            void this.applyLocale(locale);
          },
        },
      ],
    });
    await alert.present();
  }

  private async applyLocale(locale: AppLocale): Promise<void> {
    await this.i18n.setLocale(locale);
    this.current = locale;
    this.cdr.markForCheck();
  }
}

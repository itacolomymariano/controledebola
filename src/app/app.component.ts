import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { AlertController, MenuController, ToastController } from '@ionic/angular';
import Parse from 'parse';
import { parseErrorMessage } from './core/utils/parse-error.util';
import { AppInviteShareService } from './core/services/app-invite-share.service';
import { AuthService } from './core/services/auth.service';
import { DeepLinkService } from './core/services/deep-link.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { AppGuideService } from './core/services/app-guide.service';
import { I18nService } from './core/services/i18n.service';
import { WizardTourService } from './core/services/wizard-tour.service';
import { BiometricUnlockService } from './core/services/biometric-unlock.service';
import { APP_LOCALE_FLAGS, APP_LOCALE_LABELS, APP_LOCALES, AppLocale } from './core/models/app-locale.model';
import { ThemePickerComponent } from './shared/components/theme-picker/theme-picker.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  @ViewChild('menuThemePicker') menuThemePicker?: ThemePickerComponent;

  pushNotificationsEnabled = true;
  pushToggleBusy = false;
  inviteShareBusy = false;

  constructor(
    private readonly pushNotificationService: PushNotificationService,
    private readonly deepLinkService: DeepLinkService,
    private readonly appInviteShare: AppInviteShareService,
    private readonly menuCtrl: MenuController,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
    private readonly auth: AuthService,
    private readonly i18n: I18nService,
    private readonly appGuide: AppGuideService,
    private readonly wizardTour: WizardTourService,
    private readonly biometric: BiometricUnlockService
  ) {}

  ngOnInit(): void {
    void this.configureNativeChrome();
    void this.pushNotificationService.initialize();
    void this.deepLinkService.start();
  }

  /** Android 15+ (targetSdk 36) desenha atras da barra do sistema; sem inset o rodape fica tapado. */
  private async configureNativeChrome(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== 'android') return;
    document.documentElement.classList.add('native-android');
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      // StatusBar pode falhar se o plugin nao estiver sincronizado.
    }
  }

  async onMenuWillOpen(): Promise<void> {
    if (!Parse.User.current()) {
      this.pushNotificationsEnabled = false;
      return;
    }
    try {
      this.pushNotificationsEnabled = await this.pushNotificationService.isPushEnabledPreference();
    } catch {
      this.pushNotificationsEnabled = true;
    }
  }

  async onPushNotificationsToggle(event: CustomEvent): Promise<void> {
    const checked = !!(event.detail as { checked?: boolean })?.checked;
    if (this.pushToggleBusy || checked === this.pushNotificationsEnabled) {
      return;
    }

    if (!Parse.User.current()) {
      this.pushNotificationsEnabled = false;
      const toast = await this.toastCtrl.create({
        message: 'Faca login para alterar as notificacoes.',
        duration: 2500,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.pushToggleBusy = true;
    const previous = this.pushNotificationsEnabled;
    this.pushNotificationsEnabled = checked;
    try {
      await this.pushNotificationService.setPushEnabledPreference(checked);
      const toast = await this.toastCtrl.create({
        message: checked ? 'Notificacoes ativadas.' : 'Notificacoes desativadas.',
        duration: 2200,
        color: 'success',
      });
      await toast.present();
    } catch (error: unknown) {
      this.pushNotificationsEnabled = previous;
      const toast = await this.toastCtrl.create({
        message: parseErrorMessage(error) || 'Nao foi possivel alterar as notificacoes.',
        duration: 3200,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.pushToggleBusy = false;
    }
  }

  async inviteFriendsFromMenu(): Promise<void> {
    if (this.inviteShareBusy) return;
    this.inviteShareBusy = true;
    try {
      await this.menuCtrl.close('app-menu');
      await this.appInviteShare.shareInvite();
    } finally {
      this.inviteShareBusy = false;
    }
  }

  async navigateFromMenu(url: string): Promise<void> {
    await this.menuCtrl.close('app-menu');
    await this.router.navigateByUrl(url);
  }

  async startWizardFromMenu(): Promise<void> {
    await this.menuCtrl.close('app-menu');
    this.wizardTour.startFromMenu();
    if (this.wizardTour.isAuthRoute(this.router.url)) {
      await this.router.navigateByUrl('/tabs/peladas');
    }
  }

  async registerBiometricFromMenu(): Promise<void> {
    await this.menuCtrl.close('app-menu');
    const result = await this.biometric.promptFromMenu();
    if (result === 'cancelled') return;
    const toast = await this.toastCtrl.create({
      message:
        result === 'enabled'
          ? this.i18n.t('menu.biometricRegistered')
          : this.i18n.t('menu.biometricDisabled'),
      duration: 2400,
      color: 'success',
    });
    await toast.present();
  }

  async chooseLanguageFromMenu(): Promise<void> {
    await this.menuCtrl.close('app-menu');
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('menu.language'),
      inputs: APP_LOCALES.map((locale) => ({
        type: 'radio' as const,
        label: `${APP_LOCALE_FLAGS[locale]} ${APP_LOCALE_LABELS[locale]}`,
        value: locale,
        checked: locale === this.i18n.locale,
      })),
      buttons: [
        { text: this.i18n.t('confirm.cancel'), role: 'cancel' },
        {
          text: this.i18n.t('confirm.yes'),
          handler: (value: AppLocale) => {
            if (value && value !== this.i18n.locale) {
              void this.i18n.setLocale(value);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async openThemeFromMenu(): Promise<void> {
    await this.menuCtrl.close('app-menu');
    this.menuThemePicker?.openCurtain();
  }

  async openGuideFromMenu(): Promise<void> {
    await this.menuCtrl.close('app-menu');
    this.appGuide.openManual();
  }

  async logoutFromMenu(): Promise<void> {
    await this.menuCtrl.close('app-menu');
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('menu.logout'),
      message: this.i18n.t('confirm.logout'),
      buttons: [
        { text: this.i18n.t('confirm.cancel'), role: 'cancel' },
        {
          text: this.i18n.t('menu.logout'),
          role: 'destructive',
          handler: () => {
            void this.doLogout();
          },
        },
      ],
    });
    await alert.present();
  }

  private async doLogout(): Promise<void> {
    await this.menuCtrl.close('app-menu');
    await this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}

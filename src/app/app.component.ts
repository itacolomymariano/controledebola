import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController, ToastController } from '@ionic/angular';
import Parse from 'parse';
import { parseErrorMessage } from './core/utils/parse-error.util';
import { PushNotificationService } from './core/services/push-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  pushNotificationsEnabled = true;
  pushToggleBusy = false;

  constructor(
    private readonly pushNotificationService: PushNotificationService,
    private readonly menuCtrl: MenuController,
    private readonly router: Router,
    private readonly toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    void this.pushNotificationService.initialize();
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

  async navigateFromMenu(url: string): Promise<void> {
    await this.menuCtrl.close('app-menu');
    await this.router.navigateByUrl(url);
  }
}

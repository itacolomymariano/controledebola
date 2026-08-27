import { Component } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { APP_RELEASE } from '../../core/constants/app-release';
import {
  APP_SITE_URL,
  AppInviteShareService,
} from '../../core/services/app-invite-share.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  standalone: false,
})
export class AboutPage {
  appVersion = '0.0.1';
  buildNumber = '—';
  appRelease = APP_RELEASE.label;
  platformLabel = 'Web';
  inviteShareBusy = false;
  readonly companyName = 'NSN SOLUCOES DE DESENVOLVIMENTO EM TI LTDA';
  readonly logoPath = 'assets/icon/logo_controle_de_bola.png';
  readonly siteUrl = APP_SITE_URL;
  readonly siteLabel = 'controledebola.com';

  constructor(private readonly appInviteShare: AppInviteShareService) {}

  ionViewWillEnter(): void {
    void this.loadAppInfo();
  }

  async inviteFriends(): Promise<void> {
    if (this.inviteShareBusy) return;
    this.inviteShareBusy = true;
    try {
      await this.appInviteShare.shareInvite();
    } finally {
      this.inviteShareBusy = false;
    }
  }

  private async loadAppInfo(): Promise<void> {
    this.platformLabel = this.formatPlatform(Capacitor.getPlatform());
    try {
      const info = await App.getInfo();
      if (info.version) this.appVersion = info.version;
      if (info.build) this.buildNumber = info.build;
    } catch {
      // Mantem valores padrao no navegador.
    }
  }

  private formatPlatform(platform: string): string {
    switch (platform) {
      case 'android':
        return 'Android';
      case 'ios':
        return 'iOS';
      case 'web':
        return 'Web';
      default:
        return platform;
    }
  }
}

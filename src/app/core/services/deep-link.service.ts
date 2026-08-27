import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import Parse from 'parse';

/** Hosts verificados via App Links / Universal Links. */
export const APP_LINK_HOSTS = new Set(['controledebola.com', 'www.controledebola.com']);

/** Paths do site que abrem o app (nao o site de marketing inteiro). */
const APP_LINK_PATH_PREFIXES = ['/app', '/invite', '/download'];

@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  private started = false;

  constructor(private readonly router: Router) {}

  /** Escuta cold start + taps em links enquanto o app esta aberto. */
  async start(): Promise<void> {
    if (this.started || !Capacitor.isNativePlatform()) {
      return;
    }
    this.started = true;

    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        await this.handleUrl(launch.url);
      }
    } catch {
      // sem URL de lancamento
    }

    await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      void this.handleUrl(event.url);
    });
  }

  async handleUrl(rawUrl: string): Promise<void> {
    const path = this.appPathFromUrl(rawUrl);
    if (!path) {
      return;
    }

    // Convite / download / open → home do app (ou login se sem sessao).
    if (
      path === '/app' ||
      path.startsWith('/app/') ||
      path === '/invite' ||
      path.startsWith('/invite/') ||
      path === '/download' ||
      path.startsWith('/download/')
    ) {
      await this.navigateHome();
      return;
    }
  }

  private appPathFromUrl(rawUrl: string): string | null {
    try {
      const url = new URL(rawUrl);
      if (!APP_LINK_HOSTS.has(url.hostname.toLowerCase())) {
        return null;
      }
      const path = url.pathname.replace(/\/+$/, '') || '/';
      const matched = APP_LINK_PATH_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`)
      );
      return matched ? path : null;
    } catch {
      return null;
    }
  }

  private async navigateHome(): Promise<void> {
    if (!Parse.User.current()) {
      await this.router.navigateByUrl('/login');
      return;
    }
    await this.router.navigateByUrl('/tabs/peladas');
  }
}

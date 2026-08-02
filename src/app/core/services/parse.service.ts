import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import Parse from 'parse';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ParseService {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    Parse.initialize(environment.parse.appId, environment.parse.javascriptKey);
    Parse.serverURL = this.resolveServerUrl();
    this.initialized = true;
  }

  /** No browser (ng serve), usa proxy local. No app nativo, HTTPS direto ao Back4App. */
  private resolveServerUrl(): string {
    if (Capacitor.getPlatform() === 'web') {
      return '/parse';
    }
    return environment.parse.serverURL;
  }

  get isConfigured(): boolean {
    return (
      !environment.parse.appId.includes('COLE_SEU') &&
      !environment.parse.javascriptKey.includes('COLE_SUA')
    );
  }
}

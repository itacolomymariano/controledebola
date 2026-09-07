import { Injectable } from '@angular/core';

export const APP_GUIDE_URL = 'https://controledebola.com/guia';

@Injectable({ providedIn: 'root' })
export class AppGuideService {
  openManual(): void {
    window.open(APP_GUIDE_URL, '_blank', 'noopener,noreferrer');
  }
}

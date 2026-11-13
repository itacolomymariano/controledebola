import { Injectable } from '@angular/core';

const STORAGE_KEY = 'cb_signup_attribution_v1';

export interface SignupAttribution {
  signupSource: string;
  signupUtmMedium?: string;
  signupUtmCampaign?: string;
  capturedAt: string;
}

/** Persiste utm_source da landing/deep link ate o cadastro. */
@Injectable({ providedIn: 'root' })
export class SignupAttributionService {
  captureFromUrl(rawUrl: string): void {
    try {
      const url = new URL(rawUrl);
      const source =
        url.searchParams.get('utm_source')?.trim() ||
        url.searchParams.get('src')?.trim() ||
        '';
      if (!source) {
        return;
      }
      const payload: SignupAttribution = {
        signupSource: source.slice(0, 48),
        signupUtmMedium: url.searchParams.get('utm_medium')?.trim().slice(0, 48) || undefined,
        signupUtmCampaign: url.searchParams.get('utm_campaign')?.trim().slice(0, 96) || undefined,
        capturedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // URL invalida
    }
  }

  getForRegister(): Pick<SignupAttribution, 'signupSource' | 'signupUtmMedium' | 'signupUtmCampaign'> | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as SignupAttribution;
      if (!parsed?.signupSource) {
        return null;
      }
      return {
        signupSource: parsed.signupSource,
        signupUtmMedium: parsed.signupUtmMedium,
        signupUtmCampaign: parsed.signupUtmCampaign,
      };
    } catch {
      return null;
    }
  }

  clearAfterRegister(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

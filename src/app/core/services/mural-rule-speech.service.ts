import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class MuralRuleSpeechService {
  readonly speaking$ = new BehaviorSubject<boolean>(false);

  private run = 0;

  constructor(private readonly i18n: I18nService) {}

  get speaking(): boolean {
    return this.speaking$.value;
  }

  async speak(text: string): Promise<void> {
    const content = text?.trim();
    if (!content) return;
    if (this.speaking) {
      await this.stop();
    }
    const current = ++this.run;
    const lang = this.i18n.locale || 'pt-BR';
    this.setSpeaking(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.speak({
          text: content,
          lang,
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });
        if (current === this.run) this.setSpeaking(false);
        return;
      }
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        this.setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang = lang;
      const done = () => {
        if (current === this.run) this.setSpeaking(false);
      };
      utterance.onend = done;
      utterance.onerror = done;
      synth.cancel();
      synth.speak(utterance);
    } catch {
      if (current === this.run) this.setSpeaking(false);
    }
  }

  async stop(): Promise<void> {
    this.run++;
    try {
      if (Capacitor.isNativePlatform()) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop();
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    } finally {
      this.setSpeaking(false);
    }
  }

  private setSpeaking(value: boolean): void {
    if (this.speaking$.value !== value) {
      this.speaking$.next(value);
    }
  }
}

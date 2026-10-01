import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from '../../../core/services/i18n.service';
import { MuralRuleSpeechService } from '../../../core/services/mural-rule-speech.service';

@Component({
  selector: 'app-help-balloon',
  templateUrl: './help-balloon.component.html',
  styleUrls: ['./help-balloon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HelpBalloonComponent implements OnDestroy {
  private static seq = 0;

  @Input() textKey = '';
  @Input() titleKey = 'help.title';

  readonly triggerId = `help-balloon-${++HelpBalloonComponent.seq}`;

  speaking = false;

  private startedSpeech = false;
  private readonly speakingSub: Subscription;

  constructor(
    private readonly i18n: I18nService,
    private readonly speech: MuralRuleSpeechService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.speakingSub = this.speech.speaking$.subscribe((value) => {
      this.speaking = value && this.startedSpeech;
      if (!value) this.startedSpeech = false;
      this.cdr.markForCheck();
    });
  }

  get text(): string {
    if (!this.textKey) return '';
    const t = this.i18n.t(this.textKey);
    return t === this.textKey ? '' : t;
  }

  ngOnDestroy(): void {
    this.speakingSub.unsubscribe();
    if (this.startedSpeech) {
      void this.speech.stop();
    }
  }

  async toggleSpeech(): Promise<void> {
    if (this.speaking) {
      await this.speech.stop();
      return;
    }
    const text = this.text;
    if (!text) return;
    if (this.speech.speaking) {
      await this.speech.stop();
    }
    this.startedSpeech = true;
    this.speaking = true;
    this.cdr.markForCheck();
    await this.speech.speak(text);
    this.cdr.markForCheck();
  }

  onDismiss(): void {
    if (this.startedSpeech) {
      void this.speech.stop();
    }
  }
}

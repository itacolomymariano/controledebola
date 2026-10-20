import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from '../../../core/services/i18n.service';
import { MuralRuleSpeechService } from '../../../core/services/mural-rule-speech.service';

@Component({
  selector: 'app-screen-help',
  templateUrl: './app-screen-help.component.html',
  styleUrls: ['./app-screen-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AppScreenHelpComponent implements OnDestroy {
  /** Id único do trigger (obrigatório se houver mais de um botão na mesma página). */
  @Input({ required: true }) helpId!: string;
  @Input({ required: true }) bodyKey!: string;
  @Input() titleKey = 'help.title';
  @Input() enableSpeech = false;

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

  get bodyText(): string {
    const t = this.i18n.t(this.bodyKey);
    return t === this.bodyKey ? '' : t;
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
    const text = this.bodyText;
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

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { I18nService } from '../../../core/services/i18n.service';
import { MuralRuleSpeechService } from '../../../core/services/mural-rule-speech.service';
import { MuralShareService } from '../../../core/services/mural-share.service';

@Component({
  selector: 'app-mural-share-button',
  templateUrl: './mural-share-button.component.html',
  styleUrls: ['./mural-share-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralShareButtonComponent implements OnDestroy {
  private static seq = 0;

  /** Elemento do card a capturar (ion-card ou wrapper). */
  @Input() target: HTMLElement | ElementRef<HTMLElement> | null = null;
  @Input() context: MuralShareContext | null = null;
  @Input() cardTitle = '';
  @Input() disabled = false;
  /** Base da chave i18n da regra do card (ex.: mural.rule.craque). */
  @Input() ruleKey = '';

  @ViewChild('btnHost', { read: ElementRef }) btnHost?: ElementRef<HTMLElement>;

  readonly helpTriggerId = `mural-rule-help-${++MuralShareButtonComponent.seq}`;

  sharing = false;
  speaking = false;

  private startedSpeech = false;
  private readonly speakingSub: Subscription;

  constructor(
    private readonly muralShareService: MuralShareService,
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

  get ruleText(): string {
    if (!this.ruleKey || !this.context) return '';
    if (this.context.scope === 'app') {
      const tab = this.context.appMuralVariant;
      return this.firstTranslated([tab ? `${this.ruleKey}.${tab}` : '', `${this.ruleKey}.default`]);
    }
    if (this.context.scope === 'event') {
      const kind = this.context.eventKind;
      return this.firstTranslated([
        kind ? `${this.ruleKey}.evento_${kind}` : '',
        `${this.ruleKey}.evento`,
      ]);
    }
    return '';
  }

  private firstTranslated(keys: string[]): string {
    for (const key of keys) {
      if (!key) continue;
      const text = this.i18n.t(key);
      if (text !== key) return text;
    }
    return '';
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
    const text = this.ruleText;
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

  onRuleDismiss(): void {
    if (this.startedSpeech) {
      void this.speech.stop();
    }
  }

  async share(): Promise<void> {
    if (this.sharing || this.disabled || !this.context) return;
    const el = this.resolveTarget();
    if (!el) return;
    this.sharing = true;
    this.cdr.markForCheck();
    try {
      await this.muralShareService.shareCard(el, {
        ...this.context,
        cardTitle: this.cardTitle || this.context.cardTitle,
      });
    } finally {
      this.sharing = false;
      this.cdr.markForCheck();
    }
  }

  private resolveTarget(): HTMLElement | null {
    if (!this.target) {
      return this.btnHost?.nativeElement?.closest('ion-card') as HTMLElement | null;
    }
    if (this.target instanceof ElementRef) {
      return this.target.nativeElement;
    }
    return this.target;
  }
}

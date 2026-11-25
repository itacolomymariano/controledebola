import { LocaleRefreshDirective } from '../../directives/locale-refresh.directive';
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
  hostDirectives: [LocaleRefreshDirective],
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
    let base = '';
    if (this.context.scope === 'app') {
      const tab = this.context.appMuralVariant;
      base = this.firstTranslated([tab ? `${this.ruleKey}.${tab}` : '', `${this.ruleKey}.default`]);
    } else if (this.context.scope === 'event') {
      const kind = this.context.eventKind;
      base = this.firstTranslated([
        kind ? `${this.ruleKey}.evento_${kind}` : '',
        `${this.ruleKey}.evento`,
        this.ruleKey,
      ]);
    } else if (this.context.scope === 'pelada') {
      base = this.firstTranslated([
        `${this.ruleKey}.pelada`,
        `${this.ruleKey}.peladas`,
        `${this.ruleKey}.default`,
        this.ruleKey,
      ]);
    }
    return this.appendEffectiveConfirmationNote(base);
  }

  private appendEffectiveConfirmationNote(base: string): string {
    if (!base || !this.context) return base;
    const confrontosOnly =
    this.ruleKey.startsWith('mural.rule.melhorTime') ||
    this.ruleKey.startsWith('mural.rule.invencibilidade') ||
    this.ruleKey.startsWith('mural.rule.melhorAtaque') ||
    this.ruleKey.startsWith('mural.rule.melhorDefesa') ||
    this.context.appMuralVariant === 'confrontos';
    if (confrontosOnly) return base;
    const note = this.i18n.t('mural.rule.common.effectiveConfirmation');
    if (!note || note === 'mural.rule.common.effectiveConfirmation') return base;
    return `${base} ${note}`;
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
    if (this.target) {
      if (this.target instanceof ElementRef) {
        return this.target.nativeElement;
      }
      return this.target;
    }
    const host = this.btnHost?.nativeElement;
    if (!host) return null;
    const ionCard = host.closest('ion-card');
    if (ionCard) return ionCard as HTMLElement;
    const playfulShell = host.closest('.cb-playful-card__shell');
    if (playfulShell) return playfulShell as HTMLElement;
    return null;
  }
}

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-field-help',
  templateUrl: './field-help.component.html',
  styleUrls: ['./field-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FieldHelpComponent {
  private static seq = 0;

  /** Chave i18n do texto de ajuda. */
  @Input() textKey = '';
  /** Texto literal (quando não usar i18n). */
  @Input() text = '';
  @Input() ariaLabelKey = 'help.fieldAria';

  readonly triggerId = `field-help-${++FieldHelpComponent.seq}`;

  constructor(private readonly i18n: I18nService) {}

  get body(): string {
    if (this.text) return this.text;
    if (!this.textKey) return '';
    const t = this.i18n.t(this.textKey);
    return t === this.textKey ? '' : t;
  }
}

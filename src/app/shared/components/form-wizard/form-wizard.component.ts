import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-form-wizard',
  templateUrl: './form-wizard.component.html',
  styleUrls: ['./form-wizard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FormWizardComponent {
  @Input({ required: true }) progressLabel = '';
  @Input() progressValue = 0;
  @Input({ required: true }) stepTitle = '';
  @Input() stepLead = '';
  @Input() isFirst = true;
  @Input() isLast = false;
  @Input() continueLabelKey = 'formWizard.continue';
  @Input() backLabelKey = 'formWizard.back';
  @Input() submitLabelKey = 'formWizard.submit';
  @Input() continueDisabled = false;
  @Input() submitDisabled = false;
  /** Chave i18n para app-help-balloon no cabeçalho do passo. */
  @Input() stepHelpKey = '';
  @Input() showExit = true;

  @Output() readonly continue = new EventEmitter<void>();
  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly submit = new EventEmitter<void>();
  @Output() readonly exit = new EventEmitter<void>();

  onContinue(): void {
    this.continue.emit();
  }

  onBack(): void {
    this.back.emit();
  }

  onSubmit(): void {
    this.submit.emit();
  }

  onExit(): void {
    this.exit.emit();
  }
}

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-event-detail-admin-settings-panel',
  templateUrl: './event-detail-admin-settings-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventDetailAdminSettingsPanelComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) adminForm!: FormGroup;
  @Input() supportsArrivalOrder = false;
  @Input() savingAdmin = false;
  @Input() lockParticipationFee = false;

  @Output() back = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  private formSub?: Subscription;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['adminForm']) {
      this.formSub?.unsubscribe();
      this.formSub = this.adminForm.statusChanges.subscribe(() => {
        this.cdr.markForCheck();
      });
    }
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  onSave(event?: Event): void {
    event?.preventDefault();
    this.save.emit();
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WizardTourService } from '../../../core/services/wizard-tour.service';

@Component({
  selector: 'app-coach-hint',
  templateUrl: './coach-hint.component.html',
  styleUrls: ['./coach-hint.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CoachHintComponent implements OnInit, OnDestroy {
  @Input({ required: true }) tipId = '';
  @Input({ required: true }) titleKey = '';
  @Input({ required: true }) bodyKey = '';

  visible = false;

  private activeSub?: Subscription;

  constructor(
    private readonly tour: WizardTourService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.activeSub = this.tour.active$.subscribe(() => {
      this.visible = false;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.activeSub?.unsubscribe();
  }

  dismiss(): void {
    this.visible = false;
    this.cdr.markForCheck();
  }
}

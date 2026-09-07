import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { AppStorageService } from '../../../core/services/app-storage.service';

@Component({
  selector: 'app-coach-hint',
  templateUrl: './coach-hint.component.html',
  styleUrls: ['./coach-hint.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CoachHintComponent implements OnInit {
  @Input({ required: true }) tipId = '';
  @Input({ required: true }) titleKey = '';
  @Input({ required: true }) bodyKey = '';

  visible = false;

  constructor(
    private readonly storage: AppStorageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.visible = !(await this.storage.isCoachHintDismissed(this.tipId));
    this.cdr.markForCheck();
  }

  async dismiss(): Promise<void> {
    await this.storage.dismissCoachHint(this.tipId);
    this.visible = false;
    this.cdr.markForCheck();
  }
}

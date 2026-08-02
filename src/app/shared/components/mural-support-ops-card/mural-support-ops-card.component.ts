import { Component, Input, OnChanges } from '@angular/core';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { EventSupportOpsSnapshot } from '../../../core/models/support-role-tools.model';
import { SupportRoleToolsService } from '../../../core/services/support-role-tools.service';

@Component({
  selector: 'app-mural-support-ops-card',
  templateUrl: './mural-support-ops-card.component.html',
  styleUrls: ['./mural-support-ops-card.component.scss'],
  standalone: false,
})
export class MuralSupportOpsCardComponent implements OnChanges {
  @Input({ required: true }) eventId!: string;
  @Input() shareContext: MuralShareContext | null = null;

  loading = false;
  snapshot: EventSupportOpsSnapshot | null = null;

  constructor(private readonly supportTools: SupportRoleToolsService) {}

  ngOnChanges(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.eventId) return;
    this.loading = true;
    try {
      this.snapshot = await this.supportTools.getEventSupportOpsSnapshot(this.eventId);
    } finally {
      this.loading = false;
    }
  }
}

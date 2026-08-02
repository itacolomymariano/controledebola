import { Component, Input, OnChanges } from '@angular/core';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralScope } from '../../../core/models/mural.model';
import { FanHighlightEntry } from '../../../core/models/support-role-tools.model';
import { SupportRoleToolsService } from '../../../core/services/support-role-tools.service';

@Component({
  selector: 'app-mural-fan-highlights',
  templateUrl: './mural-fan-highlights.component.html',
  styleUrls: ['./mural-fan-highlights.component.scss'],
  standalone: false,
})
export class MuralFanHighlightsComponent implements OnChanges {
  @Input({ required: true }) scope!: MuralScope;
  @Input() scopeId?: string;
  @Input() shareContext: MuralShareContext | null = null;

  loading = false;
  entries: FanHighlightEntry[] = [];

  constructor(private readonly supportTools: SupportRoleToolsService) {}

  ngOnChanges(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.entries = await this.supportTools.getFanHighlightRankings(this.scope, this.scopeId);
    } finally {
      this.loading = false;
    }
  }
}

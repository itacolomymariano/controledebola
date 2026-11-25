import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralScope } from '../../../core/models/mural.model';
import { FanHighlightEntry } from '../../../core/models/support-role-tools.model';
import { SupportRoleToolsService } from '../../../core/services/support-role-tools.service';
import { muralPlayfulNestedTone } from '../../../core/utils/mural-playful-tone.util';
import { PlayfulCardTone } from '../playful-card/playful-card.component';

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
  @Input() filterCaption = '';
  @Input() playfulChrome = false;

  loading = false;
  entries: FanHighlightEntry[] = [];

  constructor(private readonly supportTools: SupportRoleToolsService) {}

  readonly fanParentTone: PlayfulCardTone = 'users';

  fanNestedTone(childIndex: number): PlayfulCardTone {
    return muralPlayfulNestedTone(this.fanParentTone, childIndex);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['scope'] && !changes['scopeId']) {
      return;
    }
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

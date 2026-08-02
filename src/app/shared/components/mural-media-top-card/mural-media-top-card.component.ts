import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { EventMediaTopItem, EventMediaTopKind } from '../../../core/models/event-media.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { EventMediaService } from '../../../core/services/event-media.service';

@Component({
  selector: 'app-mural-media-top-card',
  templateUrl: './mural-media-top-card.component.html',
  styleUrls: ['./mural-media-top-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralMediaTopCardComponent implements OnChanges {
  @Input() scope: 'app' | 'pelada' = 'app';
  @Input() peladaId = '';
  @Input() kind: EventMediaTopKind = 'video';
  @Input() shareContext: MuralShareContext | null = null;

  loading = true;
  item: EventMediaTopItem | null = null;

  constructor(
    private readonly eventMediaService: EventMediaService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scope'] || changes['peladaId'] || changes['kind']) {
      void this.load();
    }
  }

  get title(): string {
    const kindLabel =
      this.kind === 'video' ? 'Video' : this.kind === 'radio' ? 'Radio' : 'Jornal';
    return this.scope === 'app'
      ? `${kindLabel} mais visto do app`
      : `${kindLabel} mais visto da pelada`;
  }

  async load(): Promise<void> {
    if (this.scope === 'pelada' && !this.peladaId) {
      this.item = null;
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.item = await this.eventMediaService.getTopMedia(
        this.kind,
        this.scope,
        this.scope === 'pelada' ? this.peladaId : undefined
      );
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  openItem(): void {
    if (!this.item?.eventId) return;
    const path =
      this.kind === 'video'
        ? ['/event', this.item.eventId, 'mural', 'media', 'video']
        : this.kind === 'radio'
          ? ['/event', this.item.eventId, 'mural', 'media', 'radio']
          : ['/event', this.item.eventId, 'mural', 'media', 'journal'];
    void this.router.navigate(path);
  }
}

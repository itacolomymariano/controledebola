import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EventMediaTopItem, EventMediaTopKind } from '../../../core/models/event-media.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { EventMediaService } from '../../../core/services/event-media.service';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-mural-media-top-card',
  templateUrl: './mural-media-top-card.component.html',
  styleUrls: ['./mural-media-top-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralMediaTopCardComponent implements OnChanges, OnDestroy {
  @Input() scope: 'app' | 'pelada' = 'app';
  @Input() peladaId = '';
  @Input() kind: EventMediaTopKind = 'video';
  @Input() shareContext: MuralShareContext | null = null;
  @Input() filterCaption = '';
  @Input() playfulChrome = false;

  loading = true;
  item: EventMediaTopItem | null = null;
  private localeSub?: Subscription;

  constructor(
    private readonly eventMediaService: EventMediaService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly i18n: I18nService
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  get title(): string {
    const scopeKey = this.scope === 'app' ? 'app' : 'pelada';
    const mediaKey = this.kind === 'video' ? 'video' : this.kind === 'radio' ? 'radio' : 'journal';
    return this.i18n.t(`mural.mediaTop.title.${scopeKey}.${mediaKey}`);
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scope'] || changes['peladaId'] || changes['kind']) {
      void this.load();
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
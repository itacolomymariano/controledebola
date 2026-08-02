import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from '@angular/core';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralShareService } from '../../../core/services/mural-share.service';

@Component({
  selector: 'app-mural-share-button',
  templateUrl: './mural-share-button.component.html',
  styleUrls: ['./mural-share-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralShareButtonComponent {
  /** Elemento do card a capturar (ion-card ou wrapper). */
  @Input() target: HTMLElement | ElementRef<HTMLElement> | null = null;
  @Input() context: MuralShareContext | null = null;
  @Input() cardTitle = '';
  @Input() disabled = false;

  @ViewChild('btnHost', { read: ElementRef }) btnHost?: ElementRef<HTMLElement>;

  sharing = false;

  constructor(
    private readonly muralShareService: MuralShareService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async share(): Promise<void> {
    if (this.sharing || this.disabled || !this.context) return;
    const el = this.resolveTarget();
    if (!el) return;
    this.sharing = true;
    this.cdr.markForCheck();
    try {
      await this.muralShareService.shareCard(el, {
        ...this.context,
        cardTitle: this.cardTitle || this.context.cardTitle,
      });
    } finally {
      this.sharing = false;
      this.cdr.markForCheck();
    }
  }

  private resolveTarget(): HTMLElement | null {
    if (!this.target) {
      return this.btnHost?.nativeElement?.closest('ion-card') as HTMLElement | null;
    }
    if (this.target instanceof ElementRef) {
      return this.target.nativeElement;
    }
    return this.target;
  }
}

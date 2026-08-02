import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import * as QRCode from 'qrcode';
import { EventGateTicket } from '../../../core/models/event-gate-ticket.model';

@Component({
  selector: 'app-event-gate-ticket-card',
  templateUrl: './event-gate-ticket-card.component.html',
  styleUrls: ['./event-gate-ticket-card.component.scss'],
  standalone: false,
})
export class EventGateTicketCardComponent implements OnChanges {
  @Input() ticket: EventGateTicket | null = null;
  @Input() fallbackAdminAvatarUrl?: string;
  @Input() eventLocation = '';

  @Output() qrRendered = new EventEmitter<void>();

  qrDataUrl = '';
  qrRendering = false;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get adminAvatarUrl(): string | undefined {
    return this.ticket?.authorizedByAdminAvatarUrl?.trim() || this.fallbackAdminAvatarUrl?.trim() || undefined;
  }

  get locationLabel(): string {
    return this.eventLocation.trim() || this.ticket?.eventLocation?.trim() || '';
  }

  ngOnChanges(): void {
    void this.renderQr();
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    void this.renderQr();
  }

  formatDateTime(value: string | undefined): string {
    if (!value?.trim()) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private async renderQr(): Promise<void> {
    this.qrDataUrl = '';
    if (!this.ticket?.qrPayload?.trim()) {
      this.qrRendering = false;
      this.cdr.markForCheck();
      return;
    }
    this.qrRendering = true;
    this.cdr.markForCheck();
    try {
      const qrSize = Math.min(280, Math.max(220, Math.floor(window.innerWidth * 0.72)));
      this.qrDataUrl = await QRCode.toDataURL(this.ticket.qrPayload, {
        margin: 1,
        width: qrSize,
      });
      this.qrRendered.emit();
    } catch {
      this.qrDataUrl = '';
    } finally {
      this.qrRendering = false;
      this.cdr.markForCheck();
    }
  }
}

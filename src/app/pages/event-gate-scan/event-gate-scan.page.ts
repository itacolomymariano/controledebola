import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { EventGateTicketValidation } from '../../core/models/event-gate-ticket.model';
import { EventGateTicketService } from '../../core/services/event-gate-ticket.service';

@Component({
  selector: 'app-event-gate-scan',
  templateUrl: './event-gate-scan.page.html',
  styleUrls: ['./event-gate-scan.page.scss'],
  standalone: false,
})
export class EventGateScanPage {
  eventId = '';
  scanning = false;
  result: EventGateTicketValidation | null = null;
  readonly scannerElementId = 'event-gate-qr-reader';
  private scanner: Html5Qrcode | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly gateTicketService: EventGateTicketService
  ) {}

  ionViewWillEnter(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
  }

  ionViewWillLeave(): void {
    void this.stopScanner();
  }

  async startScanner(): Promise<void> {
    this.result = null;
    if (this.scanning) return;
    this.scanning = true;
    this.scanner = new Html5Qrcode(this.scannerElementId);
    try {
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          void this.handleScan(decodedText);
        },
        () => undefined
      );
    } catch {
      this.scanning = false;
      this.result = {
        valid: false,
        message: 'Nao foi possivel abrir a camera. Verifique as permissoes.',
      };
    }
  }

  async stopScanner(): Promise<void> {
    if (!this.scanner) {
      this.scanning = false;
      return;
    }
    try {
      if (this.scanning) {
        await this.scanner.stop();
      }
      await this.scanner.clear();
    } catch {
      // Ignora falha ao encerrar scanner.
    }
    this.scanner = null;
    this.scanning = false;
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

  private async handleScan(qrPayload: string): Promise<void> {
    await this.stopScanner();
    try {
      this.result = await this.gateTicketService.validateTicket(this.eventId, qrPayload);
    } catch {
      this.result = { valid: false, message: 'Erro ao validar ingresso.' };
    }
  }
}

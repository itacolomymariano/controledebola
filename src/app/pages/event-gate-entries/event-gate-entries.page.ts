import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EventGateEntry } from '../../core/models/event-gate-ticket.model';
import { EventGateTicketService } from '../../core/services/event-gate-ticket.service';
import { RegistrationService } from '../../core/services/registration.service';

@Component({
  selector: 'app-event-gate-entries',
  templateUrl: './event-gate-entries.page.html',
  styleUrls: ['./event-gate-entries.page.scss'],
  standalone: false,
})
export class EventGateEntriesPage {
  eventId = '';
  loading = true;
  entries: EventGateEntry[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly gateTicketService: EventGateTicketService,
    readonly registrationService: RegistrationService
  ) {}

  ionViewWillEnter(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load();
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

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.entries = await this.gateTicketService.listEntries(this.eventId);
    } finally {
      this.loading = false;
    }
  }
}

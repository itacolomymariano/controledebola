import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import Parse from 'parse';
import { Subscription } from 'rxjs';
import { Address, normalizeBrazilUf } from '../../core/models/address.model';
import { isEventPast, PeladaEvent, PeladaEventListItem } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';
import { ParseService } from '../../core/services/parse.service';
import { RegistrationService } from '../../core/services/registration.service';

interface EventListBadge {
  label: string;
  color: string;
}

interface EventListRow {
  event: PeladaEventListItem;
  badges: EventListBadge[];
  typeLabel: string;
  dateLabel: string;
  feeLabel: string;
  locationLabel: string;
}

@Component({
  selector: 'app-events',
  templateUrl: './events.page.html',
  styleUrls: ['./events.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventsPage implements OnDestroy {
  eventRows: EventListRow[] = [];
  loading = true;
  errorMessage = '';
  parseConfigured = false;

  private eventsSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly eventService: EventService,
    private readonly parseService: ParseService,
    private readonly registrationService: RegistrationService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.eventsSub = this.eventService.onEventsChanged.subscribe(() => {
      void this.loadEvents();
    });
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.parseConfigured = this.parseService.isConfigured;
    void this.loadEvents();
  }

  createEvent(): void {
    void this.router.navigateByUrl('/event-create');
  }

  openEvent(row: EventListRow): void {
    void this.router.navigate(['/event', row.event.objectId]);
  }

  retry(): void {
    void this.loadEvents();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadEvents();
    event.target.complete();
  }

  private async loadEvents(): Promise<void> {
    if (!this.parseConfigured) {
      this.loading = false;
      this.errorMessage = 'Configure as chaves do Back4App em environment.local.ts';
      this.cdr.markForCheck();
      return;
    }

    const showSpinner = this.eventRows.length === 0;
    if (showSpinner) {
      this.loading = true;
    }
    this.errorMessage = '';

    try {
      const user = Parse.User.current();
      const address = (user?.get('address') as Address) ?? undefined;
      const { participated, member } = await this.registrationService.getParticipatedEventIds();
      const userCity = address?.city?.toLowerCase().trim();

      const list = await this.eventService.listForFeed({
        userCity,
        participatedEventIds: participated,
        memberEventIds: member,
      });

      this.eventRows = list.map((event) => {
        const isRegistered = participated.has(event.objectId);
        const isPast = isEventPast(event.endTime);
        const enriched: PeladaEventListItem = {
          ...event,
          memberBadge: member.has(event.objectId),
          isRegistered,
          isPast,
          registrationStatusLabel: this.eventService.registrationStatusLabel(event),
          nearby: !!userCity && event.address.city?.toLowerCase().trim() === userCity,
        };
        return this.toEventListRow(enriched);
      });
    } catch (error: unknown) {
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.errorMessage =
        error instanceof Error ? error.message : 'Nao foi possivel carregar os eventos.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private toEventListRow(event: PeladaEventListItem): EventListRow {
    return {
      event,
      badges: this.buildBadges(event),
      typeLabel: this.eventService.formatType(event.type),
      dateLabel: this.formatDate(event.startTime),
      feeLabel: this.eventService.formatParticipationFee(event.participationFee),
      locationLabel: this.formatLocation(event),
    };
  }

  private buildBadges(event: PeladaEventListItem): EventListBadge[] {
    const badges: EventListBadge[] = [];

    if (event.memberBadge) {
      badges.push({ label: 'Socio', color: 'primary' });
    }

    if (event.isRegistered) {
      badges.push({
        label: event.isPast ? 'Participei' : 'Ja inscrito',
        color: event.isPast ? 'medium' : 'success',
      });
    }

    if (event.registrationStatusLabel) {
      const color =
        event.registrationStatusLabel === 'Inscricoes abertas' ? 'tertiary' : 'warning';
      badges.push({ label: event.registrationStatusLabel, color });
    }

    if (event.nearby && !event.isRegistered) {
      badges.push({ label: 'Perto de voce', color: 'primary' });
    }

    return badges;
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private formatLocation(event: PeladaEvent): string {
    const { neighborhood, city } = event.address;
    const state = normalizeBrazilUf(event.address.state);
    return [neighborhood, city, state].filter(Boolean).join(' - ');
  }
}

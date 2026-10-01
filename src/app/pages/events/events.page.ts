import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import Parse from 'parse';
import { Subscription } from 'rxjs';
import { Address, normalizeBrazilUf } from '../../core/models/address.model';
import { TeamMatchListItem } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';
import {
  MatchChallengeItem,
  MatchChallengeService,
} from '../../core/services/match-challenge.service';
import { ParseService } from '../../core/services/parse.service';

interface ConfrontoRow {
  match: TeamMatchListItem;
  dateLabel: string;
  locationLabel: string;
  badge?: string;
}

@Component({
  selector: 'app-events',
  templateUrl: './events.page.html',
  styleUrls: ['./events.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventsPage implements OnDestroy {
  rows: ConfrontoRow[] = [];
  acceptedChallenges: MatchChallengeItem[] = [];
  loading = true;
  errorMessage = '';
  parseConfigured = false;
  currentUserId = '';

  private eventsSub?: Subscription;
  private challengeSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly eventService: EventService,
    private readonly challengeService: MatchChallengeService,
    private readonly parseService: ParseService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.eventsSub = this.eventService.onEventsChanged.subscribe(() => {
      void this.loadMatches();
    });
    this.challengeSub = this.challengeService.onChanged.subscribe(() => {
      void this.loadMatches();
    });
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe();
    this.challengeSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.parseConfigured = this.parseService.isConfigured;
    this.currentUserId = Parse.User.current()?.id || '';
    void this.loadMatches();
  }

  createDesafio(): void {
    void this.router.navigateByUrl('/desafio-create');
  }

  scheduleAccepted(challenge: MatchChallengeItem): void {
    void this.router.navigate(['/confronto-create'], {
      queryParams: { challengeId: challenge.objectId },
    });
  }

  openMatch(row: ConfrontoRow): void {
    void this.router.navigate(['/event', row.match.objectId]);
  }

  retry(): void {
    void this.loadMatches();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadMatches();
    event.target.complete();
  }

  private async loadMatches(): Promise<void> {
    if (!this.parseConfigured) {
      this.loading = false;
      this.errorMessage = 'Configure as chaves do Back4App em environment.local.ts';
      this.cdr.markForCheck();
      return;
    }

    const showSpinner = this.rows.length === 0;
    if (showSpinner) this.loading = true;
    this.errorMessage = '';

    try {
      const [list, challenges] = await Promise.all([
        this.eventService.listTeamMatchesForFeed(),
        this.challengeService.listMine().catch(() => [] as MatchChallengeItem[]),
      ]);
      this.acceptedChallenges = challenges.filter(
        (row) => row.status === 'accepted' && row.challengerUserId === this.currentUserId
      );
      this.rows = list.map((match) => ({
        match,
        dateLabel: this.formatDate(match.startTime),
        locationLabel: this.formatLocation(match.address, match.locationComplement),
        badge: match.returnOfEventId ? 'Volta' : match.hasReturnLeg ? 'Ida' : undefined,
      }));
    } catch (error: unknown) {
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.errorMessage =
        error instanceof Error ? error.message : 'Nao foi possivel carregar os confrontos.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private formatLocation(address: Address, complement: string): string {
    const state = normalizeBrazilUf(address.state);
    return [complement, address.neighborhood, address.city, state].filter(Boolean).join(' - ');
  }
}

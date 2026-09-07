import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import Parse from 'parse';
import { Subscription } from 'rxjs';
import { Address } from '../../core/models/address.model';
import { formatPeladaLocation, PeladaListItem } from '../../core/models/pelada.model';
import { AuthService } from '../../core/services/auth.service';
import { ParseService } from '../../core/services/parse.service';
import { PeladaService } from '../../core/services/pelada.service';
import { CoachService, CoachTip } from '../../core/services/coach.service';
import { AppGuideService } from '../../core/services/app-guide.service';
import { I18nService } from '../../core/services/i18n.service';

interface PeladaListRow {
  pelada: PeladaListItem;
  sportLabel: string;
  locationLabel: string;
}

@Component({
  selector: 'app-peladas',
  templateUrl: './peladas.page.html',
  styleUrls: ['./peladas.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeladasPage implements OnDestroy {
  peladaRows: PeladaListRow[] = [];
  loading = true;
  errorMessage = '';
  parseConfigured = false;
  coachTip: CoachTip | null = null;

  private peladasSub?: Subscription;
  private localeSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly peladaService: PeladaService,
    private readonly parseService: ParseService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly coach: CoachService,
    private readonly appGuide: AppGuideService,
    private readonly i18n: I18nService
  ) {
    this.peladasSub = this.peladaService.onPeladasChanged.subscribe(() => {
      void this.loadPeladas();
    });
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.peladasSub?.unsubscribe();
    this.localeSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.parseConfigured = this.parseService.isConfigured;
    void this.loadPeladas();
  }

  createPelada(): void {
    void this.router.navigateByUrl('/pelada-create');
  }

  openPelada(row: PeladaListRow): void {
    void this.router.navigate(['/pelada', row.pelada.objectId]);
  }

  retry(): void {
    void this.loadPeladas();
  }

  followCoach(): void {
    if (!this.coachTip) return;
    void this.router.navigateByUrl(this.coachTip.route);
  }

  openGuide(): void {
    this.appGuide.openManual();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadPeladas();
    event.target.complete();
  }

  private async loadPeladas(): Promise<void> {
    if (!this.parseConfigured) {
      this.loading = false;
      this.errorMessage = 'Configure as chaves do Back4App em environment.local.ts';
      this.cdr.markForCheck();
      return;
    }

    const showSpinner = this.peladaRows.length === 0;
    if (showSpinner) this.loading = true;
    this.errorMessage = '';

    try {
      const user = Parse.User.current();
      const address = (user?.get('address') as Address) ?? undefined;
      const userCity = address?.city;

      const peladas = await this.peladaService.listForFeed(userCity);
      this.peladaRows = peladas.map((pelada) => ({
        pelada,
        sportLabel: this.peladaService.formatSport(pelada.sport),
        locationLabel: formatPeladaLocation(pelada),
      }));
      try {
        this.coachTip = await this.coach.suggest(peladas);
      } catch {
        this.coachTip = null;
      }
    } catch (error: unknown) {
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.errorMessage =
        error instanceof Error ? error.message : this.i18n.t('peladas.loadError');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}

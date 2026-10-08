import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { formatPeladaLocation, PeladaListItem } from '../../core/models/pelada.model';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { ParseService } from '../../core/services/parse.service';
import { PeladaService } from '../../core/services/pelada.service';
import {
  compareDirectoryProximity,
  directoryTextMatches,
  loggedUserAddress,
} from './home-directory.util';

interface PeladaListRow {
  pelada: PeladaListItem;
  sportLabel: string;
  locationLabel: string;
}

@Component({
  selector: 'app-peladas-list',
  templateUrl: './peladas-list.page.html',
  styleUrls: ['./peladas.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeladasListPage implements OnDestroy {
  peladaRows: PeladaListRow[] = [];
  search = '';
  loading = true;
  errorMessage = '';
  parseConfigured = false;
  wizardPeladaJoin = false;
  private peladasSub?: Subscription;
  private localeSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly peladaService: PeladaService,
    private readonly parseService: ParseService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
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
    this.wizardPeladaJoin = this.route.snapshot.queryParamMap.get('wizard') === 'peladaJoin';
    this.parseConfigured = this.parseService.isConfigured;
    void this.loadPeladas();
    this.cdr.markForCheck();
  }

  get visibleRows(): PeladaListRow[] {
    return this.peladaRows.filter((row) =>
      directoryTextMatches(this.search, [
        row.pelada.name,
        row.pelada.adminName,
        row.pelada.adminApelido,
        row.sportLabel,
        row.locationLabel,
        row.pelada.address?.state,
        row.pelada.address?.city,
        row.pelada.address?.neighborhood,
      ])
    );
  }

  onSearchChange(value: string): void {
    this.search = value ?? '';
    this.cdr.markForCheck();
  }

  goHub(): void {
    void this.router.navigateByUrl('/tabs/peladas');
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
      const address = loggedUserAddress();
      const peladas = await this.peladaService.listForFeed(address?.city);
      const rows = peladas.map((pelada) => ({
        pelada,
        sportLabel: this.peladaService.formatSport(pelada.sport),
        locationLabel: formatPeladaLocation(pelada),
      }));
      rows.sort((a, b) =>
        compareDirectoryProximity(
          address,
          a.pelada.address,
          b.pelada.address,
          a.pelada.name,
          b.pelada.name
        )
      );
      this.peladaRows = rows;
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

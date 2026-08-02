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

  private peladasSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly peladaService: PeladaService,
    private readonly parseService: ParseService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.peladasSub = this.peladaService.onPeladasChanged.subscribe(() => {
      void this.loadPeladas();
    });
  }

  ngOnDestroy(): void {
    this.peladasSub?.unsubscribe();
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
    } catch (error: unknown) {
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.errorMessage =
        error instanceof Error ? error.message : 'Nao foi possivel carregar as peladas.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}

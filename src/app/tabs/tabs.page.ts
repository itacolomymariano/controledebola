import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { FooterTabKey, isFooterTabActive } from './tabs-footer.util';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TabsPage implements OnDestroy {
  private navSub?: Subscription;
  private currentUrl = '';

  constructor(
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.currentUrl = this.router.url;
    this.navSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl = event.urlAfterRedirects || event.url;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  isFooterTabActive(key: FooterTabKey): boolean {
    return isFooterTabActive(this.currentUrl || this.router.url, key);
  }

  /** Rodapé Peladas sempre abre a lista (não só o hub de portas). */
  openPeladasList(): void {
    void this.router.navigateByUrl('/tabs/peladas/lista');
  }

  openSearchTab(): void {
    void this.router.navigateByUrl('/tabs/search');
  }

  openEventsTab(): void {
    void this.router.navigateByUrl('/tabs/events');
  }

  openMuralTab(): void {
    void this.router.navigateByUrl('/tabs/mural');
  }

  openProfileTab(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }
}

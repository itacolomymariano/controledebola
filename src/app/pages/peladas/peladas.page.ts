import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';

type HomeDoor = 'lista' | 'confrontos' | 'times' | 'usuarios';

@Component({
  selector: 'app-peladas',
  templateUrl: './peladas.page.html',
  styleUrls: ['./peladas.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeladasPage implements OnDestroy {
  private localeSub?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly i18n: I18nService
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.cdr.markForCheck();
  }

  openDoor(door: HomeDoor): void {
    void this.router.navigate(['/tabs/peladas', door]);
  }
}

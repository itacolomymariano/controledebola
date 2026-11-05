import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { HomeDoorVariant } from '../../shared/components/home-door-card/home-door-card.component';

type HomeDoor = 'lista' | 'confrontos' | 'times' | 'usuarios';

interface HomeDoorConfig {
  id: HomeDoor;
  titleKey: string;
  hintKey: string;
  icon: string;
  variant: HomeDoorVariant;
}

@Component({
  selector: 'app-peladas',
  templateUrl: './peladas.page.html',
  styleUrls: ['./peladas.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeladasPage implements OnDestroy {
  private localeSub?: Subscription;

  readonly doors: HomeDoorConfig[] = [
    {
      id: 'lista',
      titleKey: 'peladas.door.peladas',
      hintKey: 'peladas.door.peladasHint',
      icon: 'football-outline',
      variant: 'peladas',
    },
    {
      id: 'confrontos',
      titleKey: 'peladas.door.confrontos',
      hintKey: 'peladas.door.confrontosHint',
      icon: 'swap-horizontal-outline',
      variant: 'confrontos',
    },
    {
      id: 'times',
      titleKey: 'peladas.door.times',
      hintKey: 'peladas.door.timesHint',
      icon: 'shield-outline',
      variant: 'times',
    },
    {
      id: 'usuarios',
      titleKey: 'peladas.door.users',
      hintKey: 'peladas.door.usersHint',
      icon: 'people-outline',
      variant: 'users',
    },
  ];

  constructor(
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly i18n: I18nService,
    private readonly auth: AuthService
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    if (this.auth.isLoggedIn()) {
      void this.auth.fetchCurrentUser().finally(() => this.cdr.markForCheck());
    } else {
      this.cdr.markForCheck();
    }
  }

  openDoor(door: HomeDoor): void {
    void this.router.navigate(['/tabs/peladas', door]);
  }
}

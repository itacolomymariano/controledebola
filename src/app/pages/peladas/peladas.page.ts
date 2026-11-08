import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppInviteShareService } from '../../core/services/app-invite-share.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { HomeDoorVariant } from '../../shared/components/home-door-card/home-door-card.component';

type HomeDoor = 'lista' | 'confrontos' | 'times' | 'usuarios';
type HomeHubCardId = HomeDoor | 'convidar' | 'mural';

interface HomeDoorConfig {
  id: HomeHubCardId;
  titleKey: string;
  hintKey: string;
  icon: string;
  variant: HomeDoorVariant;
  action: 'door' | 'invite' | 'mural';
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
      action: 'door',
    },
    {
      id: 'confrontos',
      titleKey: 'peladas.door.confrontos',
      hintKey: 'peladas.door.confrontosHint',
      icon: 'swap-horizontal-outline',
      variant: 'confrontos',
      action: 'door',
    },
    {
      id: 'times',
      titleKey: 'peladas.door.times',
      hintKey: 'peladas.door.timesHint',
      icon: 'shield-outline',
      variant: 'times',
      action: 'door',
    },
    {
      id: 'usuarios',
      titleKey: 'peladas.door.users',
      hintKey: 'peladas.door.usersHint',
      icon: 'people-outline',
      variant: 'users',
      action: 'door',
    },
    {
      id: 'convidar',
      titleKey: 'peladas.door.invite',
      hintKey: 'peladas.door.inviteHint',
      icon: 'share-social-outline',
      variant: 'invite',
      action: 'invite',
    },
    {
      id: 'mural',
      titleKey: 'peladas.door.mural',
      hintKey: 'peladas.door.muralHint',
      icon: 'trophy-outline',
      variant: 'mural',
      action: 'mural',
    },
  ];

  constructor(
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly i18n: I18nService,
    private readonly auth: AuthService,
    private readonly appInviteShare: AppInviteShareService
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

  activateCard(card: HomeDoorConfig): void {
    if (card.action === 'invite') {
      void this.appInviteShare.shareInvite();
      return;
    }
    if (card.action === 'mural') {
      void this.router.navigateByUrl('/tabs/mural');
      return;
    }
    void this.router.navigate(['/tabs/peladas', card.id as HomeDoor]);
  }
}

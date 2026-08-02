import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AlertController, MenuController, Platform } from '@ionic/angular';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { RefereeInvitationService } from '../../../core/services/referee-invitation.service';

@Component({
  selector: 'app-user-bar',
  templateUrl: './user-bar.component.html',
  styleUrls: ['./user-bar.component.scss'],
  standalone: false,
})
export class UserBarComponent implements OnInit, OnDestroy {
  apelido = '';
  avatarUrl: string | null = null;
  pendingInvitations = 0;

  private profileSub?: Subscription;
  private invitationSub?: Subscription;
  private routerSub?: Subscription;
  private resumeSub?: Subscription;
  private badgeRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly refereeInvitationService: RefereeInvitationService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly menuCtrl: MenuController,
    private readonly platform: Platform,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.loadUserBar();
    this.profileSub = this.auth.onProfileChanged.subscribe(() => {
      this.applyDisplayState();
      this.cdr.markForCheck();
    });
    this.invitationSub = this.refereeInvitationService.onChanged.subscribe(() => {
      void this.loadPendingInvitations();
    });
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        void this.loadPendingInvitations();
      });
    this.resumeSub = this.platform.resume.subscribe(() => {
      void this.loadPendingInvitations();
    });
    this.badgeRefreshTimer = setInterval(() => {
      void this.loadPendingInvitations();
    }, 30000);
    void this.loadPendingInvitations();
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
    this.invitationSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.resumeSub?.unsubscribe();
    if (this.badgeRefreshTimer) {
      clearInterval(this.badgeRefreshTimer);
      this.badgeRefreshTimer = null;
    }
  }

  openHome(): void {
    void this.router.navigateByUrl('/tabs/peladas');
  }

  openInbox(): void {
    void this.loadPendingInvitations();
    void this.router.navigateByUrl('/inbox');
  }

  async openMenu(): Promise<void> {
    await this.menuCtrl.open('app-menu');
  }

  async logout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sair do App',
      message: 'Deseja realmente sair?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sair',
          role: 'destructive',
          handler: () => {
            void this.doLogout();
          },
        },
      ],
    });
    await alert.present();
  }

  private async doLogout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async loadUserBar(): Promise<void> {
    if (this.auth.isLoggedIn()) {
      await this.auth.fetchCurrentUser();
    }
    this.applyDisplayState();
    void this.loadPendingInvitations();
    this.cdr.markForCheck();
  }

  private applyDisplayState(): void {
    this.apelido = this.auth.getApelido() || this.auth.getDisplayName();
    this.avatarUrl = this.auth.getAvatarUrl();
  }

  private async loadPendingInvitations(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.pendingInvitations = 0;
      return;
    }
    this.pendingInvitations = await this.refereeInvitationService.countPendingForCurrentUser();
    this.cdr.markForCheck();
  }
}

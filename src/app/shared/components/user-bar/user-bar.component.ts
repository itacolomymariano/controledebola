import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { MenuController, Platform } from '@ionic/angular';
import { Subscription, filter } from 'rxjs';
import { resolveScreenHelpKey } from '../../../core/config/screen-help.config';
import { AppMessageService } from '../../../core/services/app-message.service';
import { AuthService } from '../../../core/services/auth.service';
import { MatchChallengeService } from '../../../core/services/match-challenge.service';
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
  /** Bandeiras/tema so na pagina inicial (lista de peladas). */
  showLocaleThemePrefs = false;
  helpKey = '';

  private profileSub?: Subscription;
  private invitationSub?: Subscription;
  private challengeSub?: Subscription;
  private appMessageSub?: Subscription;
  private routerSub?: Subscription;
  private resumeSub?: Subscription;
  private badgeRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly refereeInvitationService: RefereeInvitationService,
    private readonly matchChallengeService: MatchChallengeService,
    private readonly appMessageService: AppMessageService,
    private readonly router: Router,
    private readonly menuCtrl: MenuController,
    private readonly platform: Platform,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.loadUserBar();
    this.refreshPrefsVisibility(this.router.url);
    this.profileSub = this.auth.onProfileChanged.subscribe(() => {
      this.applyDisplayState();
      this.cdr.markForCheck();
    });
    this.invitationSub = this.refereeInvitationService.onChanged.subscribe(() => {
      void this.loadPendingInvitations();
    });
    this.challengeSub = this.matchChallengeService.onChanged.subscribe(() => {
      void this.loadPendingInvitations();
    });
    this.appMessageSub = this.appMessageService.onChanged.subscribe(() => {
      void this.loadPendingInvitations();
    });
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.refreshPrefsVisibility((event as NavigationEnd).urlAfterRedirects || (event as NavigationEnd).url);
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
    this.challengeSub?.unsubscribe();
    this.appMessageSub?.unsubscribe();
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

  private refreshPrefsVisibility(url: string): void {
    const path = (url || '').split('?')[0];
    // Apenas na home (aba Peladas) — evita sobrepor toolbar de detalhes/outras abas.
    this.showLocaleThemePrefs =
      path === '/tabs/peladas' ||
      path === '/tabs' ||
      path.endsWith('/tabs/') ||
      path === '/tabs/peladas/';
    this.helpKey = resolveScreenHelpKey(url);
    this.cdr.markForCheck();
  }

  /** Badge = pendencias que esperam acao + mensagens nao lidas da caixa. */
  private async loadPendingInvitations(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.pendingInvitations = 0;
      return;
    }
    const attention = await this.refereeInvitationService.countPendingForCurrentUser();
    let unreadMessages = 0;
    try {
      unreadMessages = await this.appMessageService.countUnread();
    } catch {
      // Cloud sem a caixa publicada: mantem o comportamento antigo.
      unreadMessages = 0;
    }
    this.pendingInvitations = attention + unreadMessages;
    this.cdr.markForCheck();
  }
}

import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AppMessage } from '../../core/models/app-message.model';
import { TeamMatchListItem, teamSideLabel } from '../../core/models/event.model';
import { hireableRoleLabel, HireableRole } from '../../core/models/event-hiring.model';
import {
  RefereeInvitation,
  SupplementaryHiringOpportunity,
  TeamMatchRefereeHiringApprovalItem,
} from '../../core/models/referee-invitation.model';
import { AppMessageService } from '../../core/services/app-message.service';
import { EventService, TeamMatchRescheduleProposal } from '../../core/services/event.service';
import {
  MatchChallengeItem,
  MatchChallengeService,
} from '../../core/services/match-challenge.service';
import { RefereeInvitationService } from '../../core/services/referee-invitation.service';
import {
  AmateurTeamJoinRequestItem,
  AmateurTeamJoinRequestService,
} from '../../core/services/amateur-team-join-request.service';
import {
  TeamMatchJoinRequestItem,
  TeamMatchJoinRequestService,
} from '../../core/services/team-match-join-request.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { I18nService } from '../../core/services/i18n.service';
import Parse from 'parse';

const MESSAGES_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-inbox',
  templateUrl: './inbox.page.html',
  styleUrls: ['./inbox.page.scss'],
  standalone: false,
})
export class InboxPage implements OnDestroy {
  loading = true;
  invitations: RefereeInvitation[] = [];
  paymentConfirmations: RefereeInvitation[] = [];
  supplementaryOpportunities: SupplementaryHiringOpportunity[] = [];
  teamMatchNotices: TeamMatchListItem[] = [];
  incomingChallenges: MatchChallengeItem[] = [];
  outboxChallenges: MatchChallengeItem[] = [];
  incomingJoinRequests: TeamMatchJoinRequestItem[] = [];
  outboxJoinRequests: TeamMatchJoinRequestItem[] = [];
  incomingAmateurTeamJoinRequests: AmateurTeamJoinRequestItem[] = [];
  outboxAmateurTeamJoinRequests: AmateurTeamJoinRequestItem[] = [];
  mailbox: 'in' | 'out' = 'in';
  pendingReschedules: TeamMatchRescheduleProposal[] = [];
  incomingRefereeApprovals: TeamMatchRefereeHiringApprovalItem[] = [];
  outboxRefereeApprovals: TeamMatchRefereeHiringApprovalItem[] = [];
  contractConfirmations: RefereeInvitation[] = [];
  processingId = '';
  currentUserId = '';

  messages: AppMessage[] = [];
  messagesLoading = false;
  messagesError = '';
  hasMoreMessages = false;
  searchTerm = '';
  openedMessage: AppMessage | null = null;
  returnLegChallenge: MatchChallengeItem | null = null;
  returnLegDate = '';
  returnLegTime = '';
  returnLegLocation = '';

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly invitationService: RefereeInvitationService,
    private readonly eventService: EventService,
    private readonly challengeService: MatchChallengeService,
    private readonly joinRequestService: TeamMatchJoinRequestService,
    private readonly amateurTeamJoinService: AmateurTeamJoinRequestService,
    private readonly appMessageService: AppMessageService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService
  ) {}

  private t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  ionViewWillEnter(): void {
    this.currentUserId = Parse.User.current()?.id || '';
    const box = this.route.snapshot.queryParamMap.get('box');
    this.mailbox = box === 'out' ? 'out' : 'in';
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }
  }

  setMailbox(value: 'in' | 'out'): void {
    this.mailbox = value;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { box: value === 'out' ? 'out' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.loadMessages();
  }

  /** Entrada: pendencias que ainda esperam um toque do usuario. */
  get hasPendingItems(): boolean {
    if (this.mailbox === 'out') {
      return (
        this.outboxChallenges.length > 0 ||
        this.outboxJoinRequests.length > 0 ||
        this.outboxRefereeApprovals.length > 0
      );
    }
    return (
      this.invitations.length > 0 ||
      this.contractConfirmations.length > 0 ||
      this.paymentConfirmations.length > 0 ||
      this.supplementaryOpportunities.length > 0 ||
      this.teamMatchNotices.length > 0 ||
      this.incomingChallenges.length > 0 ||
      this.incomingJoinRequests.length > 0 ||
      this.pendingReschedules.length > 0 ||
      this.incomingRefereeApprovals.length > 0
    );
  }

  get unreadMessageCount(): number {
    return this.messages.filter((message) => message.unread).length;
  }

  onSearchInput(value: string | null | undefined): void {
    this.searchTerm = (value || '').trim();
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.searchDebounce = null;
      void this.loadMessages();
    }, SEARCH_DEBOUNCE_MS);
  }

  private async loadMessages(append = false): Promise<void> {
    this.messagesLoading = true;
    this.messagesError = '';
    const skip = append ? this.messages.length : 0;
    try {
      const rows = await this.appMessageService.list(this.mailbox, {
        search: this.searchTerm,
        limit: MESSAGES_PAGE_SIZE,
        skip,
      });
      this.messages = append ? [...this.messages, ...rows] : rows;
      this.hasMoreMessages = rows.length === MESSAGES_PAGE_SIZE;
    } catch (error: unknown) {
      if (!append) this.messages = [];
      this.hasMoreMessages = false;
      this.messagesError = parseErrorMessage(error);
    } finally {
      this.messagesLoading = false;
    }
  }

  loadMoreMessages(): void {
    if (this.messagesLoading || !this.hasMoreMessages) return;
    void this.loadMessages(true);
  }

  /**
   * Abre o texto completo. Na Entrada, marca como lida.
   * Na Saida nao chama markRead: mensagem enviada nao fica nao lida para o remetente.
   */
  async openMessage(message: AppMessage): Promise<void> {
    if (this.mailbox === 'in' && message.unread) {
      message.unread = false;
      message.readAt = new Date();
      try {
        await this.appMessageService.markRead(message.objectId);
        this.invitationService.notifyBadgeRefresh();
      } catch {
        // Leitura e secundaria: o texto abre mesmo se a marcacao falhar.
      }
    }
    this.openedMessage = message;
  }

  closeOpenedMessage(): void {
    this.openedMessage = null;
  }

  messageEventRoute(message: AppMessage): string {
    const route = (message.actionRoute || '').trim();
    const path = route.split('?')[0];
    return path.startsWith('/event/') ? route : '';
  }

  openMessageEvent(): void {
    const message = this.openedMessage;
    const route = message ? this.messageEventRoute(message) : '';
    if (!route) return;
    this.openedMessage = null;
    void this.router.navigateByUrl(route);
  }

  async markAllMessagesRead(): Promise<void> {
    try {
      await this.appMessageService.markAllRead();
      this.invitationService.notifyBadgeRefresh();
      await this.loadMessages();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    }
  }

  /** Apelido e, quando houver, nome completo entre parenteses. */
  messageCounterpartIdentity(message: AppMessage): string {
    const apelido = message.counterpartApelido.trim();
    const fullName = message.counterpartFullName.trim();
    if (apelido && fullName) return `${apelido} (${fullName})`;
    if (fullName) return fullName;
    if (apelido) return apelido;
    return message.counterpartName || '—';
  }

  /** Data da mensagem (recebimento na Entrada, envio na Saida): dd/mm/aaaa. */
  messageListDate(message: AppMessage): string {
    return this.formatMessagePart(message.sentAt, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Hora da mensagem: HH:mm. */
  messageListTime(message: AppMessage): string {
    return this.formatMessagePart(message.sentAt, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /** No texto aberto: `Apelido (Nome) · dd/mm/aaaa HH:mm`. */
  messageCounterpartLine(message: AppMessage): string {
    const who = this.messageCounterpartIdentity(message);
    const when = this.formatMessageDate(message.sentAt);
    return when ? `${who} · ${when}` : who;
  }

  formatMessageDate(date: Date | null): string {
    if (!date) return '';
    const day = this.formatMessagePart(date, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = this.formatMessagePart(date, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return day && time ? `${day} ${time}` : day || time;
  }

  private formatMessagePart(
    date: Date | null,
    options: Intl.DateTimeFormatOptions
  ): string {
    if (!date) return '';
    return new Intl.DateTimeFormat(this.i18n.locale, options).format(date);
  }

  /** Recarrega convites e atualiza badge da barra superior. */
  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.invitations = await this.invitationService.listPendingForCurrentUser();
      this.incomingRefereeApprovals =
        await this.invitationService.listTeamMatchRefereeHiringApprovals('in');
      this.outboxRefereeApprovals =
        await this.invitationService.listTeamMatchRefereeHiringApprovals('out');
      this.paymentConfirmations = await this.invitationService.listAwaitingRefereePaymentConfirmation();
      this.contractConfirmations =
        await this.invitationService.listUnseenContractConfirmationsForCurrentUser();
      this.supplementaryOpportunities =
        await this.invitationService.listAcceptedForSupplementaryHiring();
      try {
        this.teamMatchNotices = await this.eventService.listTeamMatchInboxNotices();
      } catch {
        this.teamMatchNotices = [];
      }
      try {
        const challenges = await this.challengeService.listMine();
        this.incomingChallenges = challenges.filter(
          (row) => row.status === 'pending' && row.challengedUserId === this.currentUserId
        );
        this.outboxChallenges = challenges
          .filter((row) => {
            if (row.challengerUserId === this.currentUserId) return true;
            if (
              row.challengedUserId === this.currentUserId &&
              row.status !== 'pending'
            ) {
              return true;
            }
            return false;
          })
          .sort((a, b) => {
            const ta = a.createdAt?.getTime() ?? 0;
            const tb = b.createdAt?.getTime() ?? 0;
            return tb - ta;
          });
      } catch {
        this.incomingChallenges = [];
        this.outboxChallenges = [];
      }
      try {
        this.pendingReschedules = await this.eventService.listPendingTeamMatchReschedules();
      } catch {
        this.pendingReschedules = [];
      }
      try {
        const joinRows = await this.joinRequestService.listMine();
        this.incomingJoinRequests = joinRows.filter(
          (row) =>
            row.status === 'pending' && row.presidentUserId === this.currentUserId
        );
        this.outboxJoinRequests = joinRows
          .filter((row) => {
            if (row.athleteUserId === this.currentUserId) return true;
            if (
              row.presidentUserId === this.currentUserId &&
              row.status !== 'pending'
            ) {
              return true;
            }
            return false;
          })
          .sort((a, b) => {
            const ta = a.createdAt?.getTime() ?? 0;
            const tb = b.createdAt?.getTime() ?? 0;
            return tb - ta;
          });
      } catch {
        this.incomingJoinRequests = [];
        this.outboxJoinRequests = [];
      }
      try {
        const teamJoinRows = await this.amateurTeamJoinService.listMine();
        this.incomingAmateurTeamJoinRequests = teamJoinRows.filter(
          (row) => row.status === 'pending' && row.presidentUserId === this.currentUserId
        );
        this.outboxAmateurTeamJoinRequests = teamJoinRows
          .filter((row) => {
            if (row.athleteUserId === this.currentUserId) return true;
            if (row.presidentUserId === this.currentUserId && row.status !== 'pending') {
              return true;
            }
            return false;
          })
          .sort((a, b) => {
            const ta = a.createdAt?.getTime() ?? 0;
            const tb = b.createdAt?.getTime() ?? 0;
            return tb - ta;
          });
      } catch {
        this.incomingAmateurTeamJoinRequests = [];
        this.outboxAmateurTeamJoinRequests = [];
      }
      await this.loadMessages();
    } finally {
      this.loading = false;
      this.invitationService.notifyBadgeRefresh();
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat(this.i18n.locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat(this.i18n.locale, { style: 'currency', currency: 'BRL' }).format(amount);
  }

  invitationRoleLabel(invitation: RefereeInvitation): string {
    return hireableRoleLabel(invitation.role as HireableRole);
  }

  invitationTitle(invitation: RefereeInvitation): string {
    const role = this.invitationRoleLabel(invitation);
    if (invitation.eventType === 'team_match') {
      if (invitation.teamMatchLeg === 'volta') {
        return this.t('inbox.inviteTitleRoleReturn', { role });
      }
      if (invitation.teamMatchLeg === 'ida') {
        return this.t('inbox.inviteTitleRoleOutbound', { role });
      }
      return this.t('inbox.inviteTitleRoleMatch', { role });
    }
    return this.t('inbox.inviteTitleRole', { role });
  }

  invitationTeamLabel(invitation: RefereeInvitation): string {
    return teamSideLabel(invitation.teamSide);
  }

  openEvent(invitation: RefereeInvitation): void {
    void this.router.navigate(['/event', invitation.eventId]);
  }

  async openContractConfirmation(invitation: RefereeInvitation): Promise<void> {
    await this.invitationService.markContractConfirmationSeen(invitation.objectId);
    void this.router.navigate(['/event', invitation.eventId]);
  }

  openTeamMatchNotice(notice: TeamMatchListItem): void {
    void this.router.navigate(['/event', notice.objectId]);
  }

  openEventById(eventId: string): void {
    void this.router.navigate(['/event', eventId]);
  }

  viewChallengeTeam(teamId: string): void {
    void this.router.navigate(['/team', teamId]);
  }

  viewJoinAthleteProfile(request: TeamMatchJoinRequestItem): void {
    if (!request.athleteUserId) return;
    void this.router.navigate(['/athlete', request.athleteUserId]);
  }

  joinOutboxTitle(request: TeamMatchJoinRequestItem): string {
    if (request.athleteUserId === this.currentUserId) {
      return this.t('inbox.joinOutboxParticipation', { team: request.teamName || this.t('inbox.team') });
    }
    return this.t('inbox.joinOutboxReply', {
      name: request.athleteApelido || request.athleteFullName || this.t('inbox.athlete'),
    });
  }

  joinOutboxStatus(request: TeamMatchJoinRequestItem): string {
    switch (request.status) {
      case 'pending':
        return this.t('inbox.joinStatusPending');
      case 'accepted':
        return this.t('inbox.joinStatusAccepted');
      case 'declined':
        return this.t('inbox.joinStatusDeclined');
      case 'cancelled':
        return this.t('inbox.joinStatusCancelled');
      default:
        return request.status;
    }
  }

  joinOutboxIsAthlete(request: TeamMatchJoinRequestItem): boolean {
    return request.athleteUserId === this.currentUserId;
  }

  refereeApprovalSideLabel(side: TeamMatchRefereeHiringApprovalItem['refereeHiringRequestedByTeamSide']): string {
    if (side === 'home') return this.t('inbox.sideHome');
    if (side === 'away') return this.t('inbox.sideAway');
    return '—';
  }

  teamProposalLine(side: TeamMatchRefereeHiringApprovalItem['refereeHiringRequestedByTeamSide']): string {
    return this.t('inbox.teamProposal', { side: this.refereeApprovalSideLabel(side) });
  }

  refereeApprovalOutboxStatus(item: TeamMatchRefereeHiringApprovalItem): string {
    if (item.refereeHiringApprovalStatus === 'pending') {
      return this.t('inbox.refereeApprovalPending');
    }
    if (item.refereeHiringApprovalStatus === 'rejected') {
      return this.t('inbox.refereeApprovalRejected');
    }
    return item.eventName;
  }

  async approveRefereeHiring(item: TeamMatchRefereeHiringApprovalItem): Promise<void> {
    this.processingId = item.invitationId;
    try {
      await this.invitationService.respondTeamMatchRefereeHiringApproval(
        item.invitationId,
        'approved'
      );
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async rejectRefereeHiring(item: TeamMatchRefereeHiringApprovalItem): Promise<void> {
    this.processingId = item.invitationId;
    try {
      await this.invitationService.respondTeamMatchRefereeHiringApproval(
        item.invitationId,
        'rejected'
      );
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async acceptJoinRequest(request: TeamMatchJoinRequestItem): Promise<void> {
    this.processingId = request.objectId;
    try {
      await this.joinRequestService.respond(request.objectId, 'accepted');
      this.setMailbox('out');
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async acceptAmateurTeamJoinRequest(request: AmateurTeamJoinRequestItem): Promise<void> {
    this.processingId = request.objectId;
    try {
      await this.amateurTeamJoinService.respond(request.objectId, 'accepted');
      this.setMailbox('out');
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async declineAmateurTeamJoinRequest(request: AmateurTeamJoinRequestItem): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.declineRosterHeader'),
      inputs: [{ name: 'reason', type: 'textarea', placeholder: this.t('inbox.reasonOptional') }],
      buttons: [
        { text: this.t('inbox.cancel'), role: 'cancel' },
        {
          text: this.t('inbox.decline'),
          role: 'destructive',
          handler: (data) => {
            void this.respondAmateurTeamJoinDecline(request.objectId, String(data?.reason || ''));
          },
        },
      ],
    });
    await alert.present();
  }

  private async respondAmateurTeamJoinDecline(requestId: string, reason: string): Promise<void> {
    this.processingId = requestId;
    try {
      await this.amateurTeamJoinService.respond(requestId, 'declined', reason);
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  openTeamProfile(teamId: string): void {
    void this.router.navigate(['/team', teamId]);
  }

  async declineJoinRequest(request: TeamMatchJoinRequestItem): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.declineJoinHeader'),
      message: this.t('inbox.declineJoinMessage'),
      inputs: [{ name: 'reason', type: 'textarea', placeholder: this.t('inbox.reasonPlaceholder') }],
      buttons: [
        { text: this.t('inbox.cancel'), role: 'cancel' },
        {
          text: this.t('inbox.decline'),
          handler: (data) => {
            void this.confirmDeclineJoin(request.objectId, String(data?.reason || ''));
          },
        },
      ],
    });
    await alert.present();
  }

  private async confirmDeclineJoin(requestId: string, reason: string): Promise<void> {
    this.processingId = requestId;
    try {
      await this.joinRequestService.respond(requestId, 'declined', reason.trim());
      this.setMailbox('out');
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  scheduleChallenge(challenge: MatchChallengeItem): void {
    void this.router.navigate(['/confronto-create'], {
      queryParams: { challengeId: challenge.objectId },
    });
  }

  challengeOutboxTitle(challenge: MatchChallengeItem): string {
    const isSender = challenge.challengerUserId === this.currentUserId;
    if (isSender) {
      return this.t('inbox.challengeOutboxTo', { team: challenge.challengedTeamName });
    }
    return this.t('inbox.challengeOutboxReply', { team: challenge.challengerTeamName });
  }

  challengeOutboxStatus(challenge: MatchChallengeItem): string {
    switch (challenge.status) {
      case 'pending':
        return this.t('inbox.challengeStatusPending');
      case 'accepted':
        return this.t('inbox.challengeStatusAccepted');
      case 'declined':
        return this.t('inbox.challengeStatusDeclined');
      case 'scheduled':
        return this.t('inbox.challengeStatusScheduled');
      default:
        return challenge.status;
    }
  }

  challengeOutboxIsSender(challenge: MatchChallengeItem): boolean {
    return challenge.challengerUserId === this.currentUserId;
  }

  challengeLocationLabel(challenge: MatchChallengeItem): string {
    const address = challenge.proposedAddress;
    if (!address) return challenge.proposedLocationComplement || '';
    return [
      challenge.proposedLocationComplement,
      address.neighborhood,
      address.city,
      address.state,
    ]
      .filter(Boolean)
      .join(' - ');
  }

  challengeReturnLocationLabel(challenge: MatchChallengeItem): string {
    const address = challenge.returnAddress;
    return [challenge.returnLocationComplement, address?.neighborhood, address?.city, address?.state]
      .filter(Boolean)
      .join(' - ');
  }

  async acceptChallenge(challenge: MatchChallengeItem): Promise<void> {
    if (challenge.hasReturnLeg) {
      this.returnLegChallenge = challenge;
      this.returnLegDate = '';
      this.returnLegTime = '';
      this.returnLegLocation = '';
      return;
    }
    await this.confirmAcceptChallenge(challenge.objectId);
  }

  closeReturnLegModal(): void {
    this.returnLegChallenge = null;
  }

  async confirmReturnLegAccept(): Promise<void> {
    const challenge = this.returnLegChallenge;
    if (!challenge) return;
    const date = this.returnLegDate.trim();
    const time = this.returnLegTime.trim();
    const location = this.returnLegLocation.trim();
    if (!date || !time) {
      await this.showError(this.t('inbox.returnLegDateRequired'));
      return;
    }
    if (location.length < 3) {
      await this.showError(this.t('inbox.returnLegLocationRequired'));
      return;
    }
    const start = this.combineReturnDateTime(date, time);
    if (Number.isNaN(start.getTime())) {
      await this.showError(this.t('inbox.returnLegInvalidDateTime'));
      return;
    }
    const accepted = await this.confirmAcceptChallenge(challenge.objectId, {
      returnStartTime: start,
      returnLocationComplement: location,
    });
    if (accepted) this.returnLegChallenge = null;
  }

  private combineReturnDateTime(date: string, time: string): Date {
    const normalized = time.length === 5 ? `${time}:00` : time;
    return new Date(`${date}T${normalized}`);
  }

  private async confirmAcceptChallenge(
    challengeId: string,
    returnLeg?: { returnStartTime: Date; returnLocationComplement: string }
  ): Promise<boolean> {
    this.processingId = challengeId;
    try {
      await this.challengeService.respond(challengeId, 'accepted', '', returnLeg);
      this.returnLegChallenge = null;
      this.setMailbox('out');
      await this.load();
      return true;
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
      return false;
    } finally {
      this.processingId = '';
    }
  }

  async acceptReschedule(proposal: TeamMatchRescheduleProposal): Promise<void> {
    this.processingId = proposal.eventId;
    try {
      await this.eventService.respondTeamMatchReschedule(proposal.eventId, 'accepted');
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async declineReschedule(proposal: TeamMatchRescheduleProposal): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.declineRescheduleHeader'),
      message: this.t('inbox.declineJoinMessage'),
      inputs: [{ name: 'reason', type: 'textarea', placeholder: this.t('inbox.reasonPlaceholder') }],
      buttons: [
        { text: this.t('inbox.cancel'), role: 'cancel' },
        {
          text: this.t('inbox.decline'),
          handler: (data) => {
            void this.confirmDeclineReschedule(proposal.eventId, String(data?.reason || ''));
          },
        },
      ],
    });
    await alert.present();
  }

  private async confirmDeclineReschedule(eventId: string, reason: string): Promise<void> {
    this.processingId = eventId;
    try {
      await this.eventService.respondTeamMatchReschedule(eventId, 'declined', reason.trim());
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async declineChallenge(challenge: MatchChallengeItem): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.declineChallengeHeader'),
      message: this.t('inbox.declineChallengeMessage'),
      inputs: [{ name: 'reason', type: 'textarea', placeholder: this.t('inbox.reasonPlaceholder') }],
      buttons: [
        { text: this.t('inbox.cancel'), role: 'cancel' },
        {
          text: this.t('inbox.decline'),
          handler: (data) => {
            void this.confirmDecline(challenge.objectId, String(data?.reason || ''));
          },
        },
      ],
    });
    await alert.present();
  }

  private async confirmDecline(challengeId: string, reason: string): Promise<void> {
    this.processingId = challengeId;
    try {
      await this.challengeService.respond(challengeId, 'declined', reason.trim());
      this.setMailbox('out');
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  goBack(): void {
    void this.router.navigateByUrl('/tabs/peladas');
  }

  supplementaryTitle(opportunity: SupplementaryHiringOpportunity): string {
    return opportunity.mode === 'flags'
      ? this.t('inbox.supplementaryFlags')
      : this.t('inbox.supplementaryScout');
  }

  openSupplementaryHiring(opportunity: SupplementaryHiringOpportunity): void {
    void this.router.navigate(['/event', opportunity.eventId, 'supplementary-hiring'], {
      queryParams: { mode: opportunity.mode },
    });
  }

  async skipSupplementaryHiring(opportunity: SupplementaryHiringOpportunity): Promise<void> {
    this.processingId = opportunity.invitationId;
    try {
      await this.invitationService.completeSupplementaryHiring(opportunity.eventId, opportunity.role);
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async accept(invitation: RefereeInvitation): Promise<void> {
    const conflicts = await this.invitationService.getAcceptConflicts(invitation.objectId);
    const hard = conflicts.filter((row) => row.hardBlock);
    if (hard.length) {
      await this.showError(this.t('inbox.conflictHard', { event: hard[0].eventName }));
      return;
    }

    const declineable = conflicts.filter((row) => row.canDecline && row.invitationId);
    let declineIds: string[] = [];
    if (declineable.length) {
      const names = declineable.map((row) => row.eventName).join(', ');
      const confirmed = await new Promise<boolean>((resolve) => {
        void this.alertCtrl
          .create({
            header: this.t('inbox.conflictInvitesHeader'),
            message: this.t('inbox.conflictInvitesMessage', { names }),
            buttons: [
              { text: this.t('inbox.cancel'), role: 'cancel', handler: () => resolve(false) },
              { text: this.t('inbox.acceptThis'), handler: () => resolve(true) },
            ],
          })
          .then((alert) => alert.present());
      });
      if (!confirmed) return;
      declineIds = declineable
        .map((row) => row.invitationId)
        .filter((id): id is string => !!id);
    }

    this.processingId = invitation.objectId;
    const loading = await this.loadingCtrl.create({ message: this.t('inbox.acceptingInvite') });
    await loading.present();

    let accepted: RefereeInvitation;
    try {
      accepted = await this.invitationService.accept(invitation.objectId, {
        declineConflictInvitationIds: declineIds,
      });
      await this.load();
    } catch (error: unknown) {
      this.processingId = '';
      await loading.dismiss();
      await this.showError(parseErrorMessage(error));
      return;
    }

    // Fecha o loading antes do alerta — senao o overlay bloqueia o dialogo (todos os perfis).
    this.processingId = '';
    await loading.dismiss();

    const needsSupplementary = accepted.role === 'referee' || accepted.role === 'scout';
    const buttons = needsSupplementary
      ? [
          {
            text: this.t('inbox.hireNow'),
            handler: () => {
              void this.router.navigate(['/event', accepted.eventId, 'supplementary-hiring'], {
                queryParams: {
                  mode: accepted.role === 'referee' ? 'flags' : 'assistants',
                },
              });
            },
          },
          {
            text: this.t('inbox.goToEvent'),
            handler: () => {
              void this.router.navigate(['/event', accepted.eventId]);
            },
          },
          { text: this.t('inbox.backToHome'), role: 'cancel' as const },
        ]
      : [
          {
            text: this.t('inbox.goToEvent'),
            handler: () => {
              void this.router.navigate(['/event', accepted.eventId]);
            },
          },
          { text: this.t('inbox.backToHome'), role: 'cancel' as const },
        ];
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.inviteAcceptedHeader'),
      message: needsSupplementary
        ? this.t('inbox.inviteAcceptedSupplementary')
        : accepted.offeredAmount > 0
          ? this.t('inbox.inviteAcceptedPaid')
          : this.t('inbox.inviteAcceptedFree'),
      buttons,
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    const hasRemainingItems =
      this.invitations.length > 0 ||
      this.paymentConfirmations.length > 0 ||
      this.supplementaryOpportunities.length > 0;
    if (!hasRemainingItems && role === 'cancel') {
      void this.router.navigateByUrl('/tabs/peladas');
    }
  }

  async decline(invitation: RefereeInvitation): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.declineInviteHeader'),
      message: this.t('inbox.declineInviteMessage', {
        amount: this.formatCurrency(invitation.offeredAmount),
        event: invitation.eventName,
      }),
      buttons: [
        { text: this.t('inbox.cancel'), role: 'cancel' },
        {
          text: this.t('inbox.decline'),
          role: 'destructive',
          handler: () => {
            void this.doDecline(invitation.objectId);
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmPaymentReceived(invitation: RefereeInvitation): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.confirmPaymentHeader'),
      message: this.t('inbox.confirmPaymentMessage', {
        amount: this.formatCurrency(invitation.offeredAmount),
        event: invitation.eventName,
      }),
      buttons: [
        { text: this.t('inbox.cancel'), role: 'cancel' },
        {
          text: this.t('inbox.confirm'),
          handler: () => {
            void this.doConfirmPaymentReceived(invitation.objectId);
          },
        },
      ],
    });
    await alert.present();
  }

  private async doConfirmPaymentReceived(invitationId: string): Promise<void> {
    this.processingId = invitationId;
    const loading = await this.loadingCtrl.create({ message: this.t('inbox.confirming') });
    await loading.present();

    try {
      await this.invitationService.confirmPaymentReceived(invitationId);
      await this.load();
    } catch (error: unknown) {
      this.processingId = '';
      await loading.dismiss();
      await this.showError(parseErrorMessage(error));
      return;
    }

    this.processingId = '';
    await loading.dismiss();

    const alert = await this.alertCtrl.create({
      header: this.t('inbox.paymentConfirmedHeader'),
      message: this.t('inbox.paymentConfirmedMessage'),
      buttons: [this.t('inbox.ok')],
    });
    await alert.present();
  }

  private async doDecline(invitationId: string): Promise<void> {
    this.processingId = invitationId;
    try {
      await this.invitationService.decline(invitationId);
      await this.load();
      const hasRemainingItems =
        this.invitations.length > 0 ||
        this.paymentConfirmations.length > 0 ||
        this.supplementaryOpportunities.length > 0;
      if (!hasRemainingItems) {
        void this.router.navigateByUrl('/tabs/peladas');
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('inbox.error'),
      message,
      buttons: [this.t('inbox.ok')],
    });
    await alert.present();
  }
}

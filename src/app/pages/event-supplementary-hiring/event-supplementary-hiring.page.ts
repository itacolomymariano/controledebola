import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  EventInviteCandidate,
  formatCandidateRates,
  suggestOfferAmount,
} from '../../core/models/event-hiring.model';
import { PeladaEvent } from '../../core/models/event.model';
import {
  RefereeInvitation,
  SupplementaryHiringMode,
} from '../../core/models/referee-invitation.model';
import { EventService } from '../../core/services/event.service';
import { RefereeInvitationService } from '../../core/services/referee-invitation.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import {
  combineDateAndTimeInputs,
  minDateInputValue,
  resolveInviteResponseDeadline,
  toDateInputValue,
  toTimeInputValue,
} from '../../core/utils/invite-response-deadline.util';

@Component({
  selector: 'app-event-supplementary-hiring',
  templateUrl: './event-supplementary-hiring.page.html',
  styleUrls: ['./event-supplementary-hiring.page.scss'],
  standalone: false,
})
export class EventSupplementaryHiringPage {
  loading = true;
  searchLoading = false;
  sendingInvite = false;
  completing = false;
  event: PeladaEvent | null = null;
  mode: SupplementaryHiringMode = 'flags';
  search = '';
  allCandidates: EventInviteCandidate[] = [];
  displayedCandidates: EventInviteCandidate[] = [];
  sentInvitations: RefereeInvitation[] = [];
  inviteUserId = '';
  offeredAmount: number | null = null;
  responseDeadlineDate = '';
  responseDeadlineTime = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly eventService: EventService,
    private readonly roleProfileService: RoleProfileService,
    private readonly invitationService: RefereeInvitationService,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  get pageTitle(): string {
    return this.mode === 'flags' ? 'Contratar bandeiras' : 'Contratar auxiliares scout';
  }

  get hireRole(): 'referee' | 'scout' {
    return this.mode === 'flags' ? 'referee' : 'scout';
  }

  get supplementaryKind(): 'flag_assistant' | 'marking_assistant' {
    return this.mode === 'flags' ? 'flag_assistant' : 'marking_assistant';
  }

  get minResponseDeadlineDate(): string {
    return minDateInputValue();
  }

  get selectedCandidate(): EventInviteCandidate | undefined {
    if (!this.inviteUserId) return undefined;
    return this.findCandidate(this.inviteUserId);
  }

  ionViewWillEnter(): void {
    void this.load();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatCandidateSubtitle(candidate: EventInviteCandidate): string {
    const location = [candidate.city, candidate.state].filter(Boolean).join(' - ');
    const rates = formatCandidateRates(this.hireRole, candidate, (value) =>
      this.formatCurrency(value)
    );
    return [location, rates.replace(/^ · /, '')].filter(Boolean).join(' · ');
  }

  formatInvitationStatus(invitation: RefereeInvitation): string {
    switch (invitation.status) {
      case 'pending':
        return 'Aguardando resposta';
      case 'accepted':
        return 'Aceito';
      case 'declined':
        return 'Recusado';
      default:
        return invitation.status;
    }
  }

  onSearchInput(event: CustomEvent): void {
    this.search = String(event.detail.value ?? '');
    void this.applySearch();
  }

  onSearchClear(): void {
    this.search = '';
    void this.applySearch();
  }

  selectCandidate(candidate: EventInviteCandidate): void {
    this.mergeCache([candidate]);
    this.inviteUserId = candidate.userId;
    if (!this.event) return;
    const suggested = suggestOfferAmount(
      this.hireRole,
      this.event.type,
      'in_person',
      candidate
    );
    if (suggested != null) {
      this.offeredAmount = suggested;
    }
  }

  clearSelectedCandidate(): void {
    this.inviteUserId = '';
    this.offeredAmount = null;
  }

  viewProfile(candidate: EventInviteCandidate, event: Event): void {
    event.stopPropagation();
    void this.router.navigate(['/profile', this.hireRole, candidate.userId]);
  }

  async sendInvite(): Promise<void> {
    if (!this.event || !this.inviteUserId) return;
    const amount = Number(this.offeredAmount ?? 0);
    if (amount < 0) {
      await this.showError('Informe o valor da contratacao.');
      return;
    }
    const deadline = combineDateAndTimeInputs(this.responseDeadlineDate, this.responseDeadlineTime);
    if (!deadline) {
      await this.showError('Informe data e hora limite para resposta do convite.');
      return;
    }
    if (deadline <= new Date()) {
      await this.showError('O prazo para resposta deve ser futuro.');
      return;
    }

    this.sendingInvite = true;
    try {
      const candidate = this.findCandidate(this.inviteUserId);
      await this.invitationService.createSupplementary({
        eventId: this.event.objectId,
        invitedUserId: this.inviteUserId,
        kind: this.supplementaryKind,
        offeredAmount: amount,
        responseDeadline: deadline,
        invitedUserApelido: candidate?.apelido,
        invitedUserFullName: candidate?.userName,
        invitedUserAvatarUrl: candidate?.avatarUrl,
      });
      this.inviteUserId = '';
      this.offeredAmount = null;
      this.search = '';
      await this.loadInvitations();
      await this.applySearch();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.sendingInvite = false;
    }
  }

  async completeWithoutHiring(): Promise<void> {
    if (!this.event) return;
    this.completing = true;
    try {
      await this.invitationService.completeSupplementaryHiring(this.event.objectId, this.hireRole);
      void this.router.navigate(['/inbox']);
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.completing = false;
    }
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const eventId = this.route.snapshot.paramMap.get('id') ?? '';
      const modeParam = this.route.snapshot.queryParamMap.get('mode');
      this.mode = modeParam === 'assistants' ? 'assistants' : 'flags';

      this.event = await this.eventService.getById(eventId);
      if (!this.event) {
        await this.showError('Evento nao encontrado.');
        void this.router.navigateByUrl('/inbox');
        return;
      }

      const deadline = resolveInviteResponseDeadline(this.event);
      this.responseDeadlineDate = toDateInputValue(deadline);
      this.responseDeadlineTime = toTimeInputValue(deadline);

      await Promise.all([this.loadCandidates(), this.loadInvitations()]);
      await this.applySearch();
    } finally {
      this.loading = false;
    }
  }

  private async loadCandidates(): Promise<void> {
    if (!this.event) return;
    this.allCandidates =
      this.mode === 'flags'
        ? await this.roleProfileService.listRefereeFlagCandidates(this.event.address)
        : await this.roleProfileService.listScoutAssistantCandidates(this.event.address);
  }

  private async loadInvitations(): Promise<void> {
    if (!this.event) return;
    const all = await this.invitationService.listForEvent(this.event.objectId, this.hireRole);
    this.sentInvitations = all.filter(
      (invitation) => invitation.supplementaryKind === this.supplementaryKind
    );
  }

  private async applySearch(): Promise<void> {
    const query = this.search.trim();
    if (!query) {
      this.displayedCandidates = [];
      return;
    }

    this.displayedCandidates = this.roleProfileService.filterRoleCandidates(
      this.allCandidates,
      query
    );
    if (query.length < 2) return;

    this.searchLoading = true;
    try {
      const serverMatches =
        this.mode === 'flags'
          ? await this.roleProfileService.searchRefereeFlagCandidates(query, this.event?.address)
          : await this.roleProfileService.searchScoutAssistantCandidates(
              query,
              this.event?.address
            );
      if (serverMatches.length) {
        this.displayedCandidates = serverMatches;
        this.mergeCache(serverMatches);
      }
    } finally {
      this.searchLoading = false;
    }
  }

  private mergeCache(matches: EventInviteCandidate[]): void {
    const byUserId = new Map(this.allCandidates.map((item) => [item.userId, item]));
    for (const match of matches) {
      byUserId.set(match.userId, match);
    }
    this.allCandidates = Array.from(byUserId.values()).sort((a, b) =>
      (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
    );
  }

  private findCandidate(userId: string): EventInviteCandidate | undefined {
    return (
      this.allCandidates.find((item) => item.userId === userId) ??
      this.displayedCandidates.find((item) => item.userId === userId)
    );
  }

  private combineDateTime(date: string, time: string): Date | null {
    if (!date || !time) return null;
    const value = new Date(`${date}T${time}`);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toTimeInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

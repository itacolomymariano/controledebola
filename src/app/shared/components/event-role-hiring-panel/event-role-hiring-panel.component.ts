import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { PeladaEvent } from '../../../core/models/event.model';
import {
  AttendanceMode,
  EventInviteCandidate,
  formatCandidateRates,
  hireableRoleLabel,
  HireableRole,
  suggestOfferAmount,
} from '../../../core/models/event-hiring.model';
import { ProfessionalRole } from '../../../core/models/role-profile.model';
import { ProfileRole } from '../../../core/models/profile-role.model';
import { ProfileSearchResult } from '../../../core/models/profile-search.model';
import { ScheduleConflict } from '../../../core/models/event-registration.model';
import { RefereeInvitation } from '../../../core/models/referee-invitation.model';
import { FanProfileService } from '../../../core/services/fan-profile.service';
import { ProfileSearchService } from '../../../core/services/profile-search.service';
import { RefereeInvitationService } from '../../../core/services/referee-invitation.service';
import { RoleProfileService } from '../../../core/services/role-profile.service';
import { AthleteSearchService } from '../../../core/services/athlete-search.service';
import { createEventHiringProfileReturnState, persistProfileReturnNavigationState } from '../../../core/utils/profile-return-navigation.util';
import {
  combineDateAndTimeInputs,
  minDateInputValue,
  resolveInviteResponseDeadline,
  toDateInputValue,
  toTimeInputValue,
} from '../../../core/utils/invite-response-deadline.util';

@Component({
  selector: 'app-event-role-hiring-panel',
  templateUrl: './event-role-hiring-panel.component.html',
  styleUrls: ['./event-role-hiring-panel.component.scss'],
  standalone: false,
})
export class EventRoleHiringPanelComponent implements OnChanges {
  @Input({ required: true }) role!: HireableRole;
  @Input({ required: true }) event!: PeladaEvent;
  @Input() seedInvitationCount = 0;

  @Output() invitationsChanged = new EventEmitter<void>();
  @Output() panelInteraction = new EventEmitter<HireableRole>();

  loading = false;
  dataLoaded = false;
  search = '';
  searchLoading = false;
  allCandidates: EventInviteCandidate[] = [];
  displayedCandidates: EventInviteCandidate[] = [];
  invitations: RefereeInvitation[] = [];
  inviteUserId = '';
  offeredAmount: number | null = null;
  responseDeadlineDate = '';
  responseDeadlineTime = '';
  attendanceMode: AttendanceMode = 'in_person';
  sendingInvite = false;
  updatingInvitationId = '';
  arrivalDraft: Record<string, { date: string; time: string }> = {};
  private loadDataPromise: Promise<void> | null = null;
  private searchRequestId = 0;

  constructor(
    private readonly roleProfileService: RoleProfileService,
    private readonly fanProfileService: FanProfileService,
    private readonly profileSearchService: ProfileSearchService,
    private readonly athleteSearchService: AthleteSearchService,
    private readonly invitationService: RefereeInvitationService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
  ) {}

  get roleLabel(): string {
    return hireableRoleLabel(this.role);
  }

  get searchAnchorId(): string {
    return `hiring-role-search-${this.role}`;
  }

  get inviteFormAnchorId(): string {
    return `hiring-role-invite-${this.role}`;
  }

  get invitationsAnchorId(): string {
    return `hiring-role-invitations-${this.role}`;
  }

  get invitationBadgeCount(): number {
    return Math.max(this.seedInvitationCount, this.invitations.length);
  }

  get offeredAmountDisplay(): string {
    return this.offeredAmount == null ? '' : String(this.offeredAmount);
  }

  get minResponseDeadlineDate(): string {
    return minDateInputValue();
  }

  get responseDeadlineInvalid(): boolean {
    const deadline = combineDateAndTimeInputs(this.responseDeadlineDate, this.responseDeadlineTime);
    return !!deadline && deadline <= new Date();
  }

  get isFanRole(): boolean {
    return this.role === 'fan';
  }

  get isAthleteRole(): boolean {
    return this.role === 'athlete';
  }

  get showAttendanceMode(): boolean {
    return this.isFanRole || this.role === 'cameraman' || this.role === 'narrator';
  }

  private get supportsAttendanceMode(): boolean {
    return this.showAttendanceMode;
  }

  ngOnChanges(): void {
    this.applyDefaultResponseDeadline();
  }

  onExpand(): void {
    this.applyDefaultResponseDeadline();
    void this.ensureExpandedLoad();
  }

  ensureExpandedLoad(): Promise<void> {
    if (this.dataLoaded) {
      return Promise.resolve();
    }
    if (this.loadDataPromise) {
      return this.loadDataPromise;
    }
    this.loadDataPromise = this.loadData().finally(() => {
      this.loadDataPromise = null;
    });
    return this.loadDataPromise;
  }

  onSearchChange(value: string): void {
    this.search = value ?? '';
    void this.applySearch();
  }

  onSearchInput(event: CustomEvent): void {
    void this.ensureExpandedLoad().then(() => {
      this.onSearchChange(String(event.detail.value ?? ''));
    });
  }

  onSearchClear(): void {
    this.search = '';
    this.displayedCandidates = [];
    this.cdr.markForCheck();
  }

  onCandidateClick(candidate: EventInviteCandidate, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectCandidate(candidate);
  }

  get selectedCandidate(): EventInviteCandidate | undefined {
    if (!this.inviteUserId) return undefined;
    return this.findCandidate(this.inviteUserId);
  }

  selectCandidate(candidate: EventInviteCandidate): void {
    this.mergeCandidatesCache([candidate]);
    this.onCandidateChange(candidate.userId);
    this.panelInteraction.emit(this.role);
    this.cdr.markForCheck();
  }

  onInviteFormInteraction(): void {
    this.panelInteraction.emit(this.role);
  }

  onOfferedAmountInput(event: CustomEvent): void {
    this.onInviteFormInteraction();
    const raw = String(event.detail.value ?? '').trim().replace(',', '.');
    if (!raw) {
      this.offeredAmount = null;
      return;
    }
    const parsed = Number(raw);
    this.offeredAmount = Number.isFinite(parsed) ? parsed : null;
  }

  async restoreSearch(query: string): Promise<void> {
    await this.ensureExpandedLoad();
    this.search = query;
    await this.applySearch();
    this.cdr.markForCheck();
  }

  viewCandidateProfile(candidate: EventInviteCandidate, event: Event): void {
    event.stopPropagation();
    const returnState = createEventHiringProfileReturnState(
      this.event.objectId,
      this.role,
      this.search
    );
    persistProfileReturnNavigationState(returnState);
    if (this.role === 'athlete') {
      void this.router.navigate(['/athlete', candidate.userId], { state: returnState });
      return;
    }
    void this.router.navigate(['/profile', this.role, candidate.userId], { state: returnState });
  }

  clearSelectedCandidate(): void {
    this.inviteUserId = '';
    this.offeredAmount = null;
    this.cdr.markForCheck();
  }

  onCandidateChange(userId: string): void {
    this.inviteUserId = userId;
    const candidate = this.findCandidate(userId);
    if (!candidate) return;
    const suggested = suggestOfferAmount(
      this.role,
      this.event.type,
      this.attendanceMode,
      candidate
    );
    if (suggested != null) {
      this.offeredAmount = suggested;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  formatCandidateLabel(candidate: EventInviteCandidate): string {
    const location = [candidate.city, candidate.state].filter(Boolean).join(' - ');
    const rates = formatCandidateRates(this.role, candidate, (value) => this.formatCurrency(value));
    return `${candidate.apelido || candidate.userName}${location ? ` · ${location}` : ''}${rates}`;
  }

  formatCandidateSubtitle(candidate: EventInviteCandidate): string {
    const location = [candidate.city, candidate.state].filter(Boolean).join(' - ');
    const rates = formatCandidateRates(this.role, candidate, (value) => this.formatCurrency(value));
    return [location, rates.replace(/^ · /, '')].filter(Boolean).join(' · ');
  }

  formatInvitationStatus(invitation: RefereeInvitation): string {
    switch (invitation.status) {
      case 'pending':
        return 'Aguardando resposta';
      case 'accepted':
        if (invitation.excusedFault) return 'Falta justificada registrada';
        if (invitation.paymentConfirmedByReferee) return 'Pagamento confirmado pelo convidado';
        if (invitation.paymentReleased || invitation.paymentConfirmedByAdmin) {
          return 'Pagamento enviado pelo admin';
        }
        if (invitation.presenceConfirmed) return 'Presenca confirmada';
        return invitation.attendanceMode === 'remote'
          ? 'Aguardando confirmacao remota'
          : 'Aceito — aguardando presenca';
      case 'declined':
        return 'Recusado';
      case 'cancelled':
        return 'Cancelado/expirado';
      default:
        return invitation.status;
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  getArrivalDraft(invitation: RefereeInvitation): { date: string; time: string } {
    const existing = this.arrivalDraft[invitation.objectId];
    if (existing) return existing;
    const draft = invitation.arrivalAt
      ? { date: this.toDateInput(invitation.arrivalAt), time: this.toTimeInput(invitation.arrivalAt) }
      : { date: '', time: '' };
    this.arrivalDraft[invitation.objectId] = draft;
    return draft;
  }

  async sendInvite(): Promise<void> {
    if (!this.inviteUserId) return;
    const amount = Number(this.offeredAmount ?? 0);
    if (amount < 0) {
      await this.showError('Informe o valor da contratacao.');
      return;
    }
    const deadline = combineDateAndTimeInputs(this.responseDeadlineDate, this.responseDeadlineTime);
    if (!deadline) {
      await this.showError('Informe data e hora limite para resposta do convite.');
      this.scrollToInviteForm();
      return;
    }
    if (deadline <= new Date()) {
      await this.showError(
        'O prazo para resposta deve ser futuro. Ajuste data e hora limite no formulario do convite.'
      );
      this.scrollToInviteForm();
      return;
    }

    const candidate = this.findCandidate(this.inviteUserId);
    this.sendingInvite = true;
    this.panelInteraction.emit(this.role);
    this.cdr.markForCheck();

    try {
      const proceed = await this.confirmInviteeScheduleConflict(candidate);
      if (!proceed) {
        return;
      }

      const loading = await this.loadingCtrl.create({ message: 'Enviando convite...' });
      await loading.present();
      try {
        await this.invitationService.create({
          eventId: this.event.objectId,
          invitedUserId: this.inviteUserId,
          role: this.role,
          attendanceMode: this.supportsAttendanceMode ? this.attendanceMode : undefined,
          offeredAmount: amount,
          responseDeadline: deadline,
          invitedUserApelido: candidate?.apelido,
          invitedUserFullName: candidate?.userName,
          invitedUserAvatarUrl: candidate?.avatarUrl,
        });
        this.inviteUserId = '';
        this.offeredAmount = null;
        this.search = '';
        this.displayedCandidates = [];
        this.applyDefaultResponseDeadline();
        await this.reloadInvitations();
        this.invitationsChanged.emit();
        this.panelInteraction.emit(this.role);
        const toast = await this.toastCtrl.create({
          message: 'Convite enviado. Aguardando resposta.',
          duration: 2500,
          color: 'success',
        });
        await toast.present();
      } finally {
        await loading.dismiss();
      }
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao enviar convite.');
    } finally {
      this.sendingInvite = false;
      this.cdr.markForCheck();
    }
  }

  private async confirmInviteeScheduleConflict(
    candidate: EventInviteCandidate | undefined
  ): Promise<boolean> {
    if (!this.event?.startTime || !this.event?.endTime) return true;

    const checking = await this.loadingCtrl.create({ message: 'Verificando agenda...' });
    await checking.present();
    let conflict: ScheduleConflict | null;
    try {
      conflict = await this.invitationService.findInviteeScheduleConflict(
        this.inviteUserId,
        this.event.startTime,
        this.event.endTime,
        this.event.objectId
      );
    } finally {
      await checking.dismiss();
    }
    if (!conflict) return true;

    const name = candidate?.apelido || candidate?.userName || this.roleLabel;
    const start = this.formatDate(conflict.startTime);
    const end = this.formatDate(conflict.endTime);

    return new Promise<boolean>((resolve) => {
      void this.alertCtrl
        .create({
          header: 'Conflito de agenda',
          message:
            `${name} ja tem compromisso confirmado no evento "${conflict.eventName}" ` +
            `no mesmo horario (${start} - ${end}). Deseja enviar o convite mesmo assim?`,
          buttons: [
            { text: 'Cancelar', role: 'cancel', handler: () => resolve(false) },
            { text: 'Enviar mesmo assim', handler: () => resolve(true) },
          ],
        })
        .then((alert) => alert.present());
    });
  }

  async confirmPresence(invitation: RefereeInvitation): Promise<void> {
    const draft = this.getArrivalDraft(invitation);
    const arrivalAt = this.combineDateTime(draft.date, draft.time);
    if (!arrivalAt) {
      await this.showError('Informe data e hora da chegada.');
      return;
    }
    this.updatingInvitationId = invitation.objectId;
    try {
      await this.invitationService.setPresence(invitation.objectId, this.event.objectId, true, arrivalAt);
      await this.reloadInvitations();
      this.invitationsChanged.emit();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao confirmar presenca.');
    } finally {
      this.updatingInvitationId = '';
      this.cdr.markForCheck();
    }
  }

  async onPresenceToggle(invitation: RefereeInvitation, event: CustomEvent): Promise<void> {
    const checked = !!event.detail.checked;
    if (checked) {
      await this.confirmPresence(invitation);
      return;
    }
    this.updatingInvitationId = invitation.objectId;
    try {
      await this.invitationService.setPresence(invitation.objectId, this.event.objectId, false);
      await this.reloadInvitations();
      this.invitationsChanged.emit();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao atualizar presenca.');
    } finally {
      this.updatingInvitationId = '';
      this.cdr.markForCheck();
    }
  }

  async confirmRemotePresence(invitation: RefereeInvitation): Promise<void> {
    this.updatingInvitationId = invitation.objectId;
    try {
      await this.invitationService.confirmRemotePresence(invitation.objectId, this.event.objectId);
      await this.reloadInvitations();
      this.invitationsChanged.emit();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao confirmar assistencia remota.');
    } finally {
      this.updatingInvitationId = '';
      this.cdr.markForCheck();
    }
  }

  async onPaymentToggle(invitation: RefereeInvitation, event: CustomEvent): Promise<void> {
    this.updatingInvitationId = invitation.objectId;
    try {
      await this.invitationService.setPaymentConfirmedByAdmin(
        invitation.objectId,
        this.event.objectId,
        !!event.detail.checked
      );
      await this.reloadInvitations();
      this.invitationsChanged.emit();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao registrar pagamento.');
    } finally {
      this.updatingInvitationId = '';
      this.cdr.markForCheck();
    }
  }

  async onExcusedFaultToggle(invitation: RefereeInvitation, event: CustomEvent): Promise<void> {
    this.updatingInvitationId = invitation.objectId;
    try {
      await this.invitationService.setExcusedFault(
        invitation.objectId,
        this.event.objectId,
        !!event.detail.checked
      );
      await this.reloadInvitations();
      this.invitationsChanged.emit();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao registrar falta.');
    } finally {
      this.updatingInvitationId = '';
      this.cdr.markForCheck();
    }
  }

  private async loadData(): Promise<void> {
    if (!this.event?.objectId) return;
    this.loading = true;
    try {
      await this.reloadInvitations();

      await this.loadCandidates();
      await this.applySearch();
    } finally {
      this.loading = false;
      this.dataLoaded = true;
      this.cdr.markForCheck();
    }
  }

  private async reloadInvitations(): Promise<void> {
    if (!this.event?.objectId) return;
    try {
      this.invitations = await this.invitationService.listForEvent(this.event.objectId, this.role);
      for (const invitation of this.invitations) {
        if (invitation.arrivalAt) {
          this.arrivalDraft[invitation.objectId] = {
            date: this.toDateInput(invitation.arrivalAt),
            time: this.toTimeInput(invitation.arrivalAt),
          };
        }
      }
    } catch (error: unknown) {
      console.warn(`Falha ao listar convites (${this.role})`, error);
      this.invitations = [];
    }
  }

  private async loadCandidates(): Promise<void> {
    if (this.isFanRole) {
      this.allCandidates = await this.fanProfileService.listCandidates(this.event.address);
      return;
    }
    if (this.isAthleteRole) {
      this.allCandidates = await this.athleteSearchService.listHiringCandidates();
      return;
    }

    const role = this.role as ProfessionalRole;
    const profileRole = this.role as ProfileRole;
    await this.profileSearchService.preloadCatalog(profileRole);
    const [roleCandidates, catalogResults] = await Promise.all([
      this.roleProfileService.listRoleCandidates(role, this.event.address),
      this.profileSearchService.listCatalog(profileRole),
    ]);
    this.allCandidates = this.mergeCandidateLists(
      roleCandidates,
      catalogResults.map((entry) => this.toInviteCandidateFromProfileSearch(entry))
    );
  }

  private findCandidate(userId: string): EventInviteCandidate | undefined {
    return (
      this.allCandidates.find((item) => item.userId === userId) ??
      this.displayedCandidates.find((item) => item.userId === userId)
    );
  }

  private async applySearch(): Promise<void> {
    const requestId = ++this.searchRequestId;
    const query = this.search.trim();
    if (!query) {
      this.displayedCandidates = [];
      this.cdr.markForCheck();
      return;
    }

    this.displayedCandidates = this.filterCandidatesLocally(query);
    this.cdr.markForCheck();

    if (this.isAthleteRole) {
      this.searchLoading = true;
      try {
        const serverMatches = await this.athleteSearchService.searchHiringCandidates(
          query,
          this.allCandidates
        );
        if (requestId !== this.searchRequestId) return;
        this.displayedCandidates = serverMatches;
        this.mergeCandidatesCache(serverMatches);
      } finally {
        if (requestId === this.searchRequestId) {
          this.searchLoading = false;
          this.cdr.markForCheck();
        }
      }
      return;
    }

    if (query.length < 2) {
      return;
    }

    this.searchLoading = true;
    try {
      const localMatches = this.filterCandidatesLocally(query);
      const serverMatches = await this.searchCandidatesOnServer(query);
      if (requestId !== this.searchRequestId) return;
      this.displayedCandidates = this.mergeCandidateLists(localMatches, serverMatches);
      this.mergeCandidatesCache(this.displayedCandidates);
    } finally {
      if (requestId === this.searchRequestId) {
        this.searchLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private mergeCandidateLists(
    primary: EventInviteCandidate[],
    secondary: EventInviteCandidate[]
  ): EventInviteCandidate[] {
    const byUserId = new Map(primary.map((candidate) => [candidate.userId, candidate]));
    for (const candidate of secondary) {
      const existing = byUserId.get(candidate.userId);
      byUserId.set(candidate.userId, existing ? this.mergeInviteCandidates(existing, candidate) : candidate);
    }
    return Array.from(byUserId.values()).sort((a, b) =>
      (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
    );
  }

  private mergeInviteCandidates(
    primary: EventInviteCandidate,
    secondary: EventInviteCandidate
  ): EventInviteCandidate {
    return {
      ...primary,
      userName: primary.userName.length >= secondary.userName.length ? primary.userName : secondary.userName,
      apelido: primary.apelido || secondary.apelido,
      fullName: primary.fullName || secondary.fullName,
      avatarUrl: primary.avatarUrl || secondary.avatarUrl,
      city: primary.city || secondary.city,
      state: primary.state || secondary.state,
      proximityScore: Math.max(primary.proximityScore ?? 0, secondary.proximityScore ?? 0),
      peladaRate: primary.peladaRate ?? secondary.peladaRate,
      matchRate: primary.matchRate ?? secondary.matchRate,
      athleteRate: primary.athleteRate ?? secondary.athleteRate,
      peladaLiveRate: primary.peladaLiveRate ?? secondary.peladaLiveRate,
      matchLiveRate: primary.matchLiveRate ?? secondary.matchLiveRate,
      peladaHighlightEditRate: primary.peladaHighlightEditRate ?? secondary.peladaHighlightEditRate,
      matchHighlightEditRate: primary.matchHighlightEditRate ?? secondary.matchHighlightEditRate,
      peladaGoalNarrationEditRate:
        primary.peladaGoalNarrationEditRate ?? secondary.peladaGoalNarrationEditRate,
      matchGoalNarrationEditRate:
        primary.matchGoalNarrationEditRate ?? secondary.matchGoalNarrationEditRate,
      teamTrainingRate: primary.teamTrainingRate ?? secondary.teamTrainingRate,
      teamRate: primary.teamRate ?? secondary.teamRate,
      peladaPresentialRate: primary.peladaPresentialRate ?? secondary.peladaPresentialRate,
      peladaRemoteRate: primary.peladaRemoteRate ?? secondary.peladaRemoteRate,
      matchPresentialRate: primary.matchPresentialRate ?? secondary.matchPresentialRate,
      matchRemoteRate: primary.matchRemoteRate ?? secondary.matchRemoteRate,
    };
  }

  private toInviteCandidateFromProfileSearch(
    entry: ProfileSearchResult,
    known?: EventInviteCandidate
  ): EventInviteCandidate {
    return {
      userId: entry.userId,
      userName: entry.fullName || entry.displayName,
      apelido: entry.apelido || '',
      fullName: entry.fullName,
      avatarUrl: entry.avatarUrl || known?.avatarUrl,
      city: entry.city || known?.city,
      state: entry.state || known?.state,
      proximityScore: known?.proximityScore,
      peladaRate: known?.peladaRate,
      matchRate: known?.matchRate,
      athleteRate: known?.athleteRate,
      peladaLiveRate: known?.peladaLiveRate,
      matchLiveRate: known?.matchLiveRate,
      peladaHighlightEditRate: known?.peladaHighlightEditRate,
      matchHighlightEditRate: known?.matchHighlightEditRate,
      peladaGoalNarrationEditRate: known?.peladaGoalNarrationEditRate,
      matchGoalNarrationEditRate: known?.matchGoalNarrationEditRate,
      teamTrainingRate: known?.teamTrainingRate,
      teamRate: known?.teamRate,
    };
  }

  private mergeCandidatesCache(matches: EventInviteCandidate[]): void {
    if (!matches.length) return;
    const byUserId = new Map(this.allCandidates.map((candidate) => [candidate.userId, candidate]));
    for (const candidate of matches) {
      byUserId.set(candidate.userId, candidate);
    }
    this.allCandidates = Array.from(byUserId.values()).sort((a, b) =>
      (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
    );
  }

  private async searchCandidatesOnServer(query: string): Promise<EventInviteCandidate[]> {
    if (this.isFanRole) {
      return this.fanProfileService.searchCandidates(query, this.event.address);
    }
    if (this.isAthleteRole) {
      return this.athleteSearchService.searchHiringCandidates(query, this.allCandidates);
    }

    const role = this.role as ProfessionalRole;
    const profileRole = this.role as ProfileRole;
    const [roleMatches, profileMatches] = await Promise.all([
      this.roleProfileService.searchRoleCandidates(role, query, this.event.address),
      this.profileSearchService.search(profileRole, query),
    ]);

    return this.mergeCandidateLists(
      roleMatches,
      profileMatches.map((entry) =>
        this.toInviteCandidateFromProfileSearch(entry, this.findCandidate(entry.userId))
      )
    );
  }

  private filterCandidatesLocally(query: string): EventInviteCandidate[] {
    if (this.isFanRole) {
      return this.fanProfileService.filterCandidates(this.allCandidates, query);
    }
    if (this.isAthleteRole) {
      return this.athleteSearchService.filterHiringCandidates(this.allCandidates, query);
    }
    return this.roleProfileService.filterRoleCandidates(
      this.allCandidates,
      query,
      this.role as ProfessionalRole
    );
  }

  private applyDefaultResponseDeadline(): void {
    if (!this.event) return;
    const deadline = resolveInviteResponseDeadline(this.event);
    this.responseDeadlineDate = toDateInputValue(deadline);
    this.responseDeadlineTime = toTimeInputValue(deadline);
  }

  private scrollToInvitations(): void {
    this.cdr.markForCheck();
    setTimeout(() => {
      document.getElementById(this.invitationsAnchorId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 80);
  }

  private scrollToInviteForm(): void {
    this.cdr.markForCheck();
    setTimeout(() => {
      document.getElementById(this.inviteFormAnchorId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 80);
  }

  private combineDateTime(date: string, time: string): Date | null {
    return combineDateAndTimeInputs(date, time);
  }

  private toDateInput(date: Date): string {
    return toDateInputValue(date);
  }

  private toTimeInput(date: Date): string {
    return toTimeInputValue(date);
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import Parse from 'parse';
import { Subscription } from 'rxjs';
import { Address } from '../../core/models/address.model';
import { isEventPast, PeladaEventListItem } from '../../core/models/event.model';
import {
  MURAL_TARGET_ROLE_LABELS,
  MuralTargetRole,
} from '../../core/models/event-performance.model';
import {
  PeladaParticipant,
} from '../../core/models/pelada-participant.model';
import { ProfileRole } from '../../core/models/profile-role.model';
import { muralRankingBadgeLabel } from '../../core/utils/mural-ranking.util';
import { MuralRankingEntry } from '../../core/models/mural.model';
import { MuralHighlights } from '../../core/models/mural-highlights.model';
import { MuralParticipantLocationStats } from '../../core/models/mural-participant-stats.model';
import { MuralShareContext } from '../../core/models/mural-share.model';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';
import { PELADA_MEMBERSHIP_ROLE_LABELS, PELADA_MEMBERSHIP_STATUS_LABELS, PeladaMembership } from '../../core/models/pelada-membership.model';
import { PeladaCotinha, PeladaCotinhaPayment } from '../../core/models/pelada-cotinha.model';
import { formatPeladaLocation, Pelada, PeladaStatsConflictSource } from '../../core/models/pelada.model';
import { PeladaCashEntry } from '../../core/models/pelada-cash.model';
import { PeladaMembershipFee } from '../../core/models/pelada-monthly-fee.model';
import { EventService } from '../../core/services/event.service';
import { MuralHighlightsService } from '../../core/services/mural-highlights.service';
import { MuralParticipantStatsService } from '../../core/services/mural-participant-stats.service';
import { MuralService } from '../../core/services/mural.service';
import { MuralShareService } from '../../core/services/mural-share.service';
import { PeladaCashService } from '../../core/services/pelada-cash.service';
import { PeladaCotinhaService } from '../../core/services/pelada-cotinha.service';
import { PeladaMembershipService } from '../../core/services/pelada-membership.service';
import { PeladaMonthlyFeeService } from '../../core/services/pelada-monthly-fee.service';
import { PeladaService } from '../../core/services/pelada.service';
import { RegistrationService } from '../../core/services/registration.service';
import {
  ParticipationReviewProfile,
  ProfilePresentationRequest,
  ProfilePresentationRequestService,
} from '../../core/services/profile-presentation-request.service';

type Segment = 'eventos' | 'socios' | 'cotinhas' | 'caixa' | 'mensalidades' | 'mural' | 'configuracoes';

interface SocioListRow {
  userId: string;
  displayName: string;
  apelido: string;
  fullName?: string;
  roles: ProfileRole[];
  avatarUrl?: string;
  isSocio: boolean;
  membershipId?: string;
  membershipStatus?: PeladaMembership['status'];
}

@Component({
  selector: 'app-pelada-detail',
  templateUrl: './pelada-detail.page.html',
  styleUrls: ['./pelada-detail.page.scss'],
  standalone: false,
})
export class PeladaDetailPage implements OnDestroy {
  peladaId = '';
  pelada: Pelada | null = null;
  segment: Segment = 'eventos';
  loading = true;
  errorMessage = '';
  isAdmin = false;
  isMember = false;
  currentMembership: PeladaMembership | null = null;

  events: PeladaEventListItem[] = [];
  members: PeladaMembership[] = [];
  cotinhas: PeladaCotinha[] = [];
  cotinhaPayments: PeladaCotinhaPayment[] = [];
  selectedCotinhaId = '';
  cashSummary: {
    initialBalance: number;
    totalIn: number;
    totalOut: number;
    finalBalance: number;
  } | null = null;
  cashEntries: PeladaCashEntry[] = [];
  monthlyFees: PeladaMembershipFee[] = [];
  muralRankings: Record<MuralTargetRole, MuralRankingEntry[]> = {} as Record<
    MuralTargetRole,
    MuralRankingEntry[]
  >;
  muralHighlights: MuralHighlights | null = null;
  participantStats: MuralParticipantLocationStats | null = null;
  muralRoles = Object.keys(MURAL_TARGET_ROLE_LABELS) as MuralTargetRole[];
  participants: PeladaParticipant[] = [];
  participantSearch = '';
  socioListRows: SocioListRow[] = [];
  activeMembersForDisplay: PeladaMembership[] = [];
  togglingSocioUserId = '';
  selectedCotinhaTitle = '';
  monthlyFeesLoaded = false;
  monthlyFeesEmptyMessage = '';
  feeAmountEdits: Record<string, number> = {};

  feeYear = new Date().getFullYear();
  feeMonth = new Date().getMonth() + 1;
  cashStartDate = '';
  cashEndDate = '';

  cotinhaForm = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    targetAmount: [0, [Validators.required, Validators.min(0)]],
  });

  paymentForm = this.fb.group({
    userId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paidAt: ['', Validators.required],
  });

  cashForm = this.fb.group({
    date: ['', Validators.required],
    type: ['in', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    description: ['', Validators.required],
  });

  settingsForm = this.fb.group({
    socioGoodStandingPaymentExempt: [false],
    expulsionBanEventCount: [0, [Validators.min(0)]],
    caixaMembersOnly: [true],
    maxSocios: [0, [Validators.min(0)]],
    maxAthletesPerEvent: [0, [Validators.min(0)]],
    statsConflictSource: ['referee' as PeladaStatsConflictSource, Validators.required],
    requireProfilePresentationOnFirstEvent: [false],
    allowTeamSplitAfterEventEnd: [false],
  });

  savingSettings = false;
  profilePresentationRequests: ProfilePresentationRequest[] = [];
  loadingProfileRequests = false;
  resolvingRequestId = '';
  reviewProfile: ParticipationReviewProfile | null = null;
  reviewProfileOpen = false;
  loadingReviewProfile = false;

  private registrationsChangedSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly peladaService: PeladaService,
    private readonly membershipService: PeladaMembershipService,
    private readonly cotinhaService: PeladaCotinhaService,
    private readonly cashService: PeladaCashService,
    private readonly monthlyFeeService: PeladaMonthlyFeeService,
    private readonly eventService: EventService,
    private readonly registrationService: RegistrationService,
    private readonly profilePresentationRequestService: ProfilePresentationRequestService,
    private readonly muralService: MuralService,
    private readonly muralHighlightsService: MuralHighlightsService,
    private readonly muralParticipantStatsService: MuralParticipantStatsService,
    private readonly muralShareService: MuralShareService,
    private readonly fb: FormBuilder,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.registrationsChangedSub = this.registrationService.onRegistrationsChanged.subscribe(() => {
      if (this.isAdmin && this.segment === 'configuracoes' && this.peladaId) {
        void this.loadProfilePresentationRequests();
      }
    });
  }

  ngOnDestroy(): void {
    this.registrationsChangedSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.peladaId = this.route.snapshot.paramMap.get('id') ?? '';
    const segment = this.route.snapshot.queryParamMap.get('segment');
    if (segment && this.isSegment(segment)) {
      this.segment = segment;
    }
    void this.loadPelada();
  }

  private isSegment(value: string): value is Segment {
    return [
      'eventos',
      'socios',
      'cotinhas',
      'caixa',
      'mensalidades',
      'mural',
      'configuracoes',
    ].includes(value);
  }

  formatLocation(): string {
    return this.pelada ? formatPeladaLocation(this.pelada) : '';
  }

  formatSport(): string {
    return this.pelada ? this.peladaService.formatSport(this.pelada.sport) : '';
  }

  get showCaixaTab(): boolean {
    if (!this.pelada) return true;
    if (this.isAdmin) return true;
    if (this.pelada.caixaMembersOnly === false) return true;
    return this.isMember;
  }

  roleLabel(role: MuralTargetRole): string {
    return MURAL_TARGET_ROLE_LABELS[role];
  }

  get muralShareContext(): MuralShareContext | null {
    if (!this.pelada) return null;
    return {
      scope: 'pelada',
      ...this.muralShareService.contextFromPelada(this.pelada),
    };
  }

  rankingBadgeLabel(role: MuralTargetRole, entry: MuralRankingEntry): string {
    return muralRankingBadgeLabel(role, entry);
  }

  rankingScore(entry: MuralRankingEntry): number {
    return entry.voteCount > 0 ? entry.totalScore : entry.combinedScore;
  }

  formatParticipantRoles(roles: ProfileRole[]): string {
    return roles.map((role) => this.registrationService.formatRole(role)).join(', ');
  }

  membershipStatusLabel(status: PeladaMembership['status']): string {
    return PELADA_MEMBERSHIP_STATUS_LABELS[status];
  }

  membershipRoleLabel(role: PeladaMembership['role']): string {
    return PELADA_MEMBERSHIP_ROLE_LABELS[role];
  }

  async onSegmentChange(event: CustomEvent): Promise<void> {
    this.segment = event.detail.value as Segment;
    await this.loadSegmentData();
  }

  editPelada(): void {
    void this.router.navigate(['/pelada', this.peladaId, 'edit']);
  }

  async saveSettings(): Promise<void> {
    if (!this.pelada || !this.isAdmin) return;
    this.savingSettings = true;
    try {
      const values = this.settingsForm.getRawValue();
      this.pelada = await this.peladaService.updateSettings(this.peladaId, {
        socioGoodStandingPaymentExempt: !!values.socioGoodStandingPaymentExempt,
        expulsionBanEventCount: Number(values.expulsionBanEventCount ?? 0),
        caixaMembersOnly: !!values.caixaMembersOnly,
        maxSocios: Number(values.maxSocios ?? 0),
        maxAthletesPerEvent: Number(values.maxAthletesPerEvent ?? 0),
        statsConflictSource: values.statsConflictSource === 'scout' ? 'scout' : 'referee',
        requireProfilePresentationOnFirstEvent: !!values.requireProfilePresentationOnFirstEvent,
        allowTeamSplitAfterEventEnd: !!values.allowTeamSplitAfterEventEnd,
      });
      await this.showMessage('Configuracoes salvas.');
      await this.loadProfilePresentationRequests();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao salvar configuracoes.');
    } finally {
      this.savingSettings = false;
      this.cdr.markForCheck();
    }
  }

  async approveProfilePresentationRequest(request: ProfilePresentationRequest): Promise<void> {
    await this.resolveProfilePresentationRequest(request, 'approve');
  }

  async rejectProfilePresentationRequest(request: ProfilePresentationRequest): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Recusar solicitacao',
      message: `Recusar a participacao de ${request.userDisplayName} no evento "${request.eventName}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Recusar',
          role: 'destructive',
          handler: () => void this.resolveProfilePresentationRequest(request, 'reject'),
        },
      ],
    });
    await alert.present();
  }

  async openProfilePresentationReview(userId: string): Promise<void> {
    this.reviewProfileOpen = true;
    this.loadingReviewProfile = true;
    this.reviewProfile = null;
    this.cdr.markForCheck();
    try {
      this.reviewProfile = await this.profilePresentationRequestService.getReviewProfile(
        this.peladaId,
        userId
      );
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao carregar perfil.');
      this.reviewProfileOpen = false;
    } finally {
      this.loadingReviewProfile = false;
      this.cdr.markForCheck();
    }
  }

  closeProfilePresentationReview(): void {
    this.reviewProfileOpen = false;
    this.reviewProfile = null;
  }

  formatProfileRequestDate(date?: Date): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatProfileRequestRole(role: string): string {
    return this.registrationService.formatRole(role as ProfileRole);
  }

  formatReviewLocation(profile: ParticipationReviewProfile): string {
    return [profile.neighborhood, profile.city, profile.state].filter(Boolean).join(' · ');
  }

  openPeladaMaterial(): void {
    if (!this.peladaId) return;
    void this.router.navigate(['/material-inventory'], {
      queryParams: { ownerType: 'pelada', peladaId: this.peladaId },
    });
  }

  createEvent(): void {
    void this.router.navigate(['/event-create'], { queryParams: { peladaId: this.peladaId } });
  }

  openEvent(event: PeladaEventListItem): void {
    void this.router.navigate(['/event', event.objectId]);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  async requestMembership(): Promise<void> {
    try {
      await this.membershipService.requestMembership(this.peladaId);
      await this.loadMembership();
      await this.showMessage('Solicitacao enviada ao administrador.');
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao solicitar socio.');
    }
  }

  onParticipantSearchInput(event: CustomEvent): void {
    const value =
      event.detail?.value ??
      (event.target as { value?: string } | null)?.value ??
      '';
    this.participantSearch = String(value);
    this.cdr.markForCheck();
  }

  onParticipantSearchClear(): void {
    this.participantSearch = '';
    this.cdr.markForCheck();
  }

  socioRowMatchesSearch(row: SocioListRow): boolean {
    const term = this.participantSearch.toLowerCase().trim();
    if (!term) {
      return true;
    }
    return (
      row.displayName.toLowerCase().includes(term) ||
      row.apelido.toLowerCase().includes(term) ||
      (row.fullName?.toLowerCase().includes(term) ?? false) ||
      row.roles.some((role) => role.toLowerCase().includes(term))
    );
  }

  get socioSearchHasResults(): boolean {
    if (!this.participantSearch.trim()) {
      return this.socioListRows.length > 0;
    }
    return this.socioListRows.some((row) => this.socioRowMatchesSearch(row));
  }

  private buildSocioListRows(): void {
    const memberByUserId = this.buildBestMembershipByUserId();
    const participantUserIds = new Set(this.participants.map((participant) => participant.userId));
    const rows: SocioListRow[] = [];

    for (const participant of this.participants) {
      const membership = memberByUserId.get(participant.userId);
      rows.push({
        userId: participant.userId,
        displayName: participant.userName,
        apelido: participant.apelido,
        fullName: participant.fullName,
        roles: participant.roles,
        avatarUrl: participant.avatarUrl,
        isSocio: membership?.status === 'active',
        membershipId: membership?.objectId,
        membershipStatus: membership?.status,
      });
    }

    for (const membership of memberByUserId.values()) {
      if (participantUserIds.has(membership.userId)) {
        continue;
      }
      rows.push({
        userId: membership.userId,
        displayName: membership.userName,
        apelido: membership.userNickname || '',
        roles: [],
        avatarUrl: membership.avatarUrl,
        isSocio: membership.status === 'active',
        membershipId: membership.objectId,
        membershipStatus: membership.status,
      });
    }

    rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
    this.socioListRows = rows;
    this.cdr.markForCheck();
  }

  private buildBestMembershipByUserId(): Map<string, PeladaMembership> {
    const priority: Record<PeladaMembership['status'], number> = {
      active: 3,
      pending: 2,
      inactive: 1,
    };
    const map = new Map<string, PeladaMembership>();

    for (const member of this.members) {
      const existing = map.get(member.userId);
      if (!existing || priority[member.status] > priority[existing.status]) {
        map.set(member.userId, member);
      }
    }

    return map;
  }

  async toggleSocioMembership(row: SocioListRow, event: CustomEvent): Promise<void> {
    const checked = !!event.detail.checked;
    if (checked === row.isSocio) {
      return;
    }
    if (!this.socioRowMatchesSearch(row)) {
      return;
    }

    this.togglingSocioUserId = row.userId;
    try {
      await this.membershipService.setSocioActive(this.peladaId, row.userId, checked, {
        apelido: row.apelido,
        fullName: row.fullName,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      });
      await this.loadSocioData();
    } catch (error: unknown) {
      this.buildSocioListRows();
      await this.showError(error instanceof Error ? error.message : 'Erro ao atualizar socio.');
    } finally {
      this.togglingSocioUserId = '';
      this.cdr.markForCheck();
    }
  }

  getFeeAmount(fee: PeladaMembershipFee): number {
    return this.feeAmountEdits[fee.membershipId] ?? fee.amount;
  }

  onFeeAmountChange(membershipId: string, value: string | number): void {
    this.feeAmountEdits[membershipId] = Number(value) || 0;
  }

  async updateMemberStatus(member: PeladaMembership, status: PeladaMembership['status']): Promise<void> {
    try {
      await this.membershipService.updateStatus(member.objectId, status);
      await this.loadMembers();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao atualizar status.');
    }
  }

  async createCotinha(): Promise<void> {
    if (this.cotinhaForm.invalid) {
      this.cotinhaForm.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.cotinhaForm, {
        title: 'Titulo',
        targetAmount: 'Valor alvo',
      });
      if (message) await this.showError(message);
      return;
    }
    const v = this.cotinhaForm.getRawValue();
    try {
      await this.cotinhaService.create(this.peladaId, {
        title: v.title!,
        description: v.description?.trim() || undefined,
        targetAmount: Number(v.targetAmount ?? 0),
      });
      this.cotinhaForm.reset({ title: '', description: '', targetAmount: 0 });
      await this.loadCotinhas();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao criar cotinha.');
    }
  }

  async selectCotinha(cotinhaId: string): Promise<void> {
    this.selectedCotinhaId = cotinhaId;
    this.selectedCotinhaTitle =
      this.cotinhas.find((c) => c.objectId === cotinhaId)?.title ?? 'Cotinha';
    this.cotinhaPayments = await this.enrichCotinhaPayments(
      await this.cotinhaService.listPayments(cotinhaId)
    );
    this.resetPaymentForm();
    this.cdr.markForCheck();
  }

  async addCotinhaPayment(): Promise<void> {
    if (!this.selectedCotinhaId || this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.paymentForm, {
        userId: 'Participante',
        amount: 'Valor da contribuicao',
        paidAt: 'Data e hora',
      });
      if (message) await this.showError(message);
      return;
    }
    const v = this.paymentForm.getRawValue();
    const participant = this.participants.find((p) => p.userId === v.userId);
    try {
      await this.cotinhaService.addPayment({
        cotinhaId: this.selectedCotinhaId,
        userId: v.userId!,
        amount: Number(v.amount ?? 0),
        paidAt: new Date(v.paidAt!),
        display: participant
          ? {
              apelido: participant.apelido,
              displayName: participant.userName,
              avatarUrl: participant.avatarUrl,
            }
          : undefined,
      });
      this.resetPaymentForm();
      await this.selectCotinha(this.selectedCotinhaId);
      await this.loadCotinhas();
      if (this.isMember) await this.loadCashFlow();
      await this.showMessage('Contribuicao registrada.');
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao registrar pagamento.');
    }
  }

  async editCotinhaPayment(payment: PeladaCotinhaPayment): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Editar contribuicao',
      inputs: [
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Valor',
          value: String(payment.amount),
        },
        {
          name: 'paidAt',
          type: 'datetime-local',
          value: this.toDatetimeLocal(payment.paidAt),
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (data) => {
            void this.saveCotinhaPaymentEdit(payment.objectId, data);
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteCotinhaPayment(payment: PeladaCotinhaPayment): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Excluir contribuicao',
      message: `Excluir a contribuicao de ${payment.userName}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            void this.confirmDeleteCotinhaPayment(payment.objectId);
          },
        },
      ],
    });
    await alert.present();
  }

  async togglePaymentConfirm(payment: PeladaCotinhaPayment): Promise<void> {
    try {
      await this.cotinhaService.confirmPayment(payment.objectId, !payment.confirmedByAdmin);
      if (this.selectedCotinhaId) await this.selectCotinha(this.selectedCotinhaId);
      await this.loadCotinhas();
      if (this.isMember) await this.loadCashFlow();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao confirmar pagamento.');
    }
  }

  async loadCashFlow(): Promise<void> {
    const start = this.cashStartDate ? new Date(this.cashStartDate) : undefined;
    const end = this.cashEndDate ? new Date(this.cashEndDate) : undefined;
    const summary = await this.cashService.getCashFlow(this.peladaId, start, end);
    this.cashSummary = summary;
    this.cashEntries = summary.entries;
    this.cdr.markForCheck();
  }

  async addCashEntry(): Promise<void> {
    if (this.cashForm.invalid) {
      this.cashForm.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.cashForm, {
        date: 'Data',
        type: 'Tipo',
        amount: 'Valor',
        description: 'Descricao',
      });
      if (message) await this.showError(message);
      return;
    }
    const v = this.cashForm.getRawValue();
    try {
      await this.cashService.create(this.peladaId, {
        date: new Date(v.date!),
        type: v.type as 'in' | 'out',
        amount: Number(v.amount ?? 0),
        description: v.description!,
      });
      this.cashForm.reset({ date: '', type: 'in', amount: 0, description: '' });
      await this.loadCashFlow();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao registrar movimentacao.');
    }
  }

  async loadMonthlyFees(): Promise<void> {
    const currentUserId = Parse.User.current()?.id;
    this.monthlyFees = await this.monthlyFeeService.listForPeladaMonth(
      this.peladaId,
      this.feeYear,
      this.feeMonth,
      this.isAdmin ? undefined : { onlyUserId: currentUserId }
    );
    this.monthlyFeesLoaded = true;
    this.feeAmountEdits = {};
    for (const fee of this.monthlyFees) {
      this.feeAmountEdits[fee.membershipId] = fee.amount;
    }
    if (!this.monthlyFees.length) {
      this.monthlyFeesEmptyMessage = this.isAdmin
        ? 'Nenhum socio ativo nesta pelada. Adicione socios na aba Socios.'
        : 'Nenhuma mensalidade encontrada para voce neste mes.';
    } else if ((this.pelada?.monthlyFee ?? 0) <= 0) {
      this.monthlyFeesEmptyMessage =
        'Valor padrao nao configurado. Informe o valor de cada socio abaixo.';
    } else {
      this.monthlyFeesEmptyMessage = '';
    }
    this.cdr.markForCheck();
  }

  async generateMonthlyFees(): Promise<void> {
    try {
      await this.monthlyFeeService.generateFeesForMonth(this.peladaId, this.feeYear, this.feeMonth);
      await this.loadMonthlyFees();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao gerar mensalidades.');
    }
  }

  async toggleMonthlyFee(fee: PeladaMembershipFee): Promise<void> {
    const amount = this.getFeeAmount(fee);
    if (amount <= 0) {
      await this.showError('Informe o valor da mensalidade antes de confirmar.');
      return;
    }
    try {
      const willConfirm = !fee.paymentConfirmed;
      if (fee.objectId) {
        await this.monthlyFeeService.upsertFeeAmount(
          fee.membershipId,
          this.peladaId,
          this.feeYear,
          this.feeMonth,
          amount
        );
        await this.monthlyFeeService.confirmFee(fee.objectId, willConfirm);
      } else if (willConfirm) {
        await this.monthlyFeeService.createAndConfirmFee(
          fee.membershipId,
          this.peladaId,
          this.feeYear,
          this.feeMonth,
          amount
        );
      } else {
        await this.monthlyFeeService.upsertFeeAmount(
          fee.membershipId,
          this.peladaId,
          this.feeYear,
          this.feeMonth,
          amount
        );
      }
      await this.loadMonthlyFees();
      if (this.cashSummary) {
        await this.loadCashFlow();
      }
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao confirmar mensalidade.');
    }
  }

  private patchSettingsForm(): void {
    if (!this.pelada) return;
    this.settingsForm.patchValue({
      socioGoodStandingPaymentExempt: !!this.pelada.socioGoodStandingPaymentExempt,
      expulsionBanEventCount: this.pelada.expulsionBanEventCount ?? 0,
      caixaMembersOnly: this.pelada.caixaMembersOnly !== false,
      maxSocios: this.pelada.maxSocios ?? 0,
      maxAthletesPerEvent: this.pelada.maxAthletesPerEvent ?? 0,
      statsConflictSource: this.pelada.statsConflictSource ?? 'referee',
      requireProfilePresentationOnFirstEvent: !!this.pelada.requireProfilePresentationOnFirstEvent,
      allowTeamSplitAfterEventEnd: !!this.pelada.allowTeamSplitAfterEventEnd,
    });
  }

  private async loadPelada(): Promise<void> {
    this.loading = true;
    try {
      this.pelada = await this.peladaService.getById(this.peladaId);
      if (!this.pelada) {
        this.errorMessage = 'Pelada nao encontrada.';
        return;
      }
      this.isAdmin = this.peladaService.isCurrentUserAdmin(this.pelada);
      this.patchSettingsForm();
      await this.loadMembership();
      await this.loadSegmentData();
    } catch (error: unknown) {
      this.errorMessage = error instanceof Error ? error.message : 'Erro ao carregar pelada.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadMembership(): Promise<void> {
    this.currentMembership = await this.membershipService.getForCurrentUser(this.peladaId);
    this.isMember = this.isAdmin || this.currentMembership?.status === 'active';
  }

  private async loadSegmentData(): Promise<void> {
    switch (this.segment) {
      case 'eventos':
        await this.loadEvents();
        await this.loadProfilePresentationRequests();
        break;
      case 'socios':
        await this.loadSocioData();
        break;
      case 'cotinhas':
        await this.loadCotinhas();
        await this.loadParticipants();
        break;
      case 'caixa':
        if (this.isMember) await this.loadCashFlow();
        break;
      case 'mensalidades':
        await this.loadMonthlyFees();
        break;
      case 'mural':
        await this.loadParticipants();
        await this.loadMural();
        break;
      case 'configuracoes':
        this.patchSettingsForm();
        await this.loadProfilePresentationRequests();
        break;
    }
    this.cdr.markForCheck();
  }

  private async loadEvents(): Promise<void> {
    const user = Parse.User.current();
    const address = (user?.get('address') as Address) ?? undefined;
    const { participated, member } = await this.registrationService.getParticipatedEventIds();
    const list = await this.eventService.listForPelada(this.peladaId, {
      userCity: address?.city,
      participatedEventIds: participated,
      memberEventIds: member,
    });
    this.events = list
      .map((event) => ({
        ...event,
        memberBadge: member.has(event.objectId),
        isRegistered: participated.has(event.objectId),
        isPast: isEventPast(event.endTime),
        registrationStatusLabel: this.eventService.registrationStatusLabel(event),
        isFinished: event.isFinished,
      }))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    await this.applyAthleteAvailability();
  }

  private async applyAthleteAvailability(): Promise<void> {
    const peladaMax = Number(this.pelada?.maxAthletesPerEvent ?? 0);

    const withMax = this.events
      .map((event) => {
        const eventMax = Number(event.maxAthletesPerEvent ?? 0);
        const max = eventMax > 0 ? eventMax : peladaMax;
        return { event, max };
      })
      .filter((row) => row.max > 0 && !row.event.isFinished && !row.event.isPast);

    if (!withMax.length) {
      return;
    }

    try {
      const counts = await this.registrationService.countConfirmedAthletesForEvents(
        withMax.map((row) => row.event.objectId)
      );
      for (const { event, max } of withMax) {
        const confirmed = counts.get(event.objectId) ?? 0;
        event.maxAthletes = max;
        event.confirmedAthletes = confirmed;
        event.remainingAthleteSpots = Math.max(0, max - confirmed);
      }
      this.cdr.markForCheck();
    } catch (error: unknown) {
      console.warn('Falha ao calcular vagas restantes de atletas', error);
    }
  }

  private async loadMembers(): Promise<void> {
    if (this.isAdmin) {
      this.members = await this.membershipService.listForPeladaAsAdmin(this.peladaId);
      return;
    }
    this.members = await this.membershipService.listForPelada(this.peladaId);
  }

  private async loadSocioData(): Promise<void> {
    if (this.isAdmin) {
      await this.loadMembers();
      await this.loadParticipants();
      this.buildSocioListRows();
      return;
    }

    this.activeMembersForDisplay = await this.membershipService.listActiveForDisplay(this.peladaId);
  }

  private async loadCotinhas(): Promise<void> {
    this.cotinhas = await this.cotinhaService.listForPelada(this.peladaId);
    if (this.selectedCotinhaId) {
      await this.selectCotinha(this.selectedCotinhaId);
    }
  }

  private async loadParticipants(): Promise<void> {
    this.participants = await this.registrationService.listParticipantsForPelada(this.peladaId);
  }

  private async enrichCotinhaPayments(
    payments: PeladaCotinhaPayment[]
  ): Promise<PeladaCotinhaPayment[]> {
    if (!this.participants.length) {
      await this.loadParticipants();
    }

    return payments.map((payment) => {
      const participant = this.participants.find((row) => row.userId === payment.userId);
      if (!participant) {
        return payment;
      }

      const genericName = payment.userName === 'Usuario' || payment.userName === 'Participante';
      return {
        ...payment,
        userName: genericName ? participant.userName : payment.userName,
        avatarUrl: payment.avatarUrl || participant.avatarUrl,
      };
    });
  }

  private resetPaymentForm(): void {
    const now = this.toDatetimeLocal(new Date());
    this.paymentForm.reset({ userId: '', amount: 0, paidAt: now });
  }

  private toDatetimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private async saveCotinhaPaymentEdit(
    paymentId: string,
    data: { amount?: string; paidAt?: string }
  ): Promise<void> {
    try {
      await this.cotinhaService.updatePayment(paymentId, {
        amount: Number(data.amount ?? 0),
        paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
      });
      if (this.selectedCotinhaId) await this.selectCotinha(this.selectedCotinhaId);
      await this.loadCotinhas();
      if (this.isMember) await this.loadCashFlow();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao editar contribuicao.');
    }
  }

  private async confirmDeleteCotinhaPayment(paymentId: string): Promise<void> {
    try {
      await this.cotinhaService.deletePayment(paymentId);
      if (this.selectedCotinhaId) await this.selectCotinha(this.selectedCotinhaId);
      await this.loadCotinhas();
      if (this.isMember) await this.loadCashFlow();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao excluir contribuicao.');
    }
  }

  private async loadMural(): Promise<void> {
    const participantIds = this.participants.map((participant) => participant.userId);
    this.muralRankings = await this.muralService.getRankings('pelada', this.peladaId);
    this.muralHighlights = await this.muralHighlightsService.getHighlights(
      'pelada',
      this.peladaId,
      participantIds
    );
    this.participantStats = await this.muralParticipantStatsService.getLocationStats(
      'pelada',
      this.peladaId,
      participantIds
    );
  }

  private async loadProfilePresentationRequests(): Promise<void> {
    if (!this.isAdmin || !this.peladaId) {
      this.profilePresentationRequests = [];
      return;
    }
    this.loadingProfileRequests = true;
    try {
      this.profilePresentationRequests =
        await this.profilePresentationRequestService.listForPelada(this.peladaId);
    } catch {
      this.profilePresentationRequests = [];
    } finally {
      this.loadingProfileRequests = false;
    }
  }

  private async resolveProfilePresentationRequest(
    request: ProfilePresentationRequest,
    action: 'approve' | 'reject'
  ): Promise<void> {
    this.resolvingRequestId = request.registrationId;
    this.cdr.markForCheck();
    try {
      await this.profilePresentationRequestService.resolve(
        this.peladaId,
        request.registrationId,
        action
      );
      await this.loadProfilePresentationRequests();
      await this.showMessage(
        action === 'approve'
          ? 'Participacao aprovada.'
          : 'Solicitacao recusada.'
      );
    } catch (error: unknown) {
      await this.showError(
        error instanceof Error ? error.message : 'Erro ao processar solicitacao.'
      );
    } finally {
      this.resolvingRequestId = '';
      this.cdr.markForCheck();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }

  private async showMessage(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'OK', message, buttons: ['OK'] });
    await alert.present();
  }
}

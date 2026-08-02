import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';

import { FormBuilder, Validators } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { AlertController, IonContent, LoadingController } from '@ionic/angular';

import {
  PeladaEvent,
  hasPixKey,
  supportsArrivalOrder,
  getEffectiveVotingWindow,
  getVotingStatusLabel,
  isVotingOpen,
  getRegistrationStatus,
  isEventEnded,
  isSumulaEditOpen,
} from '../../core/models/event.model';
import { isGoalkeeperPosition } from '../../core/models/athlete-performance.model';

import {

  EventRegistration,

  EventRegistrationListItem,

} from '../../core/models/event-registration.model';

import { MuralTargetRole } from '../../core/models/event-performance.model';

import { EventPerformanceService } from '../../core/services/event-performance.service';

import { EventService } from '../../core/services/event.service';

import { RegistrationService } from '../../core/services/registration.service';
import { HIREABLE_ROLES, HireableRole } from '../../core/models/event-hiring.model';
import { EVENT_REGISTRATION_ROLES, PROFILE_ROLE_LABELS, ProfileRole } from '../../core/models/profile-role.model';

import { MuralService } from '../../core/services/mural.service';
import { eventRegistrationVoteMuralRole } from '../../core/utils/mural-role.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { normalizeSearchText } from '../../core/utils/search-text.util';
import {
  compareArrivalParticipants,
} from '../../core/utils/arrival-order.util';
import { PeladaMembershipService } from '../../core/services/pelada-membership.service';
import { PeladaService } from '../../core/services/pelada.service';
import { TeamSplitService } from '../../core/services/team-split.service';
import Parse from 'parse';
import { ScoutApontamentoService } from '../../core/services/scout-apontamento.service';
import { EventRoleHiringPanelComponent } from '../../shared/components/event-role-hiring-panel/event-role-hiring-panel.component';
import { EventGateTicket } from '../../core/models/event-gate-ticket.model';
import { EventGateTicketService } from '../../core/services/event-gate-ticket.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { RefereeInvitationService } from '../../core/services/referee-invitation.service';
import {
  ParticipationReviewProfile,
  ProfilePresentationRequestService,
} from '../../core/services/profile-presentation-request.service';
import {
  EventMaterialSession,
  EventMaterialSource,
  MaterialInventoryItem,
  MaterialItemType,
} from '../../core/models/material-inventory.model';
import { MaterialInventoryService } from '../../core/services/material-inventory.service';
import {
  consumeProfileReturnNavigationState,
  peekProfileReturnNavigationState,
} from '../../core/utils/profile-return-navigation.util';
import {
  buildEventDetailOverviewViewModel,
  buildEventVotingPeriodLabels,
} from '../../core/utils/event-detail-display.util';
import {
  EventDetailOverviewViewModel,
} from '../../shared/components/event-detail-overview/event-detail-overview.component';

interface EventDetailActionTile {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
  active?: boolean;
}

@Component({

  selector: 'app-event-detail',

  templateUrl: './event-detail.page.html',

  styleUrls: ['./event-detail.page.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,

  standalone: false,

})

export class EventDetailPage implements OnDestroy {

  event: PeladaEvent | null = null;
  eventOverview: EventDetailOverviewViewModel | null = null;
  votingPeriodLabels: ReturnType<typeof buildEventVotingPeriodLabels> = null;
  adminActionTileRows: EventDetailActionTile[][] = [];
  userActionTileRows: EventDetailActionTile[][] = [];
  gateActionTileRows: EventDetailActionTile[][] = [];

  private registrationsChangedSub?: Subscription;

  registration: EventRegistration | null = null;

  participants: EventRegistrationListItem[] = [];
  confirmedParticipants: EventRegistrationListItem[] = [];
  filteredParticipants: EventRegistrationListItem[] = [];
  filteredConfirmedParticipants: EventRegistrationListItem[] = [];

  loading = true;

  isAdmin = false;

  cancelling = false;

  savingAdmin = false;

  showAdminPanel = false;

  showHiringPanel = false;

  showGatePanel = false;

  showVotingPanel = false;

  showParticipantsPanel = false;

  showMaterialPanel = false;
  materialSession: EventMaterialSession | null = null;
  materialInventory: MaterialInventoryItem[] = [];
  materialBusy = false;
  materialPartialQuantities: Record<string, number> = {};
  materialBlindCounts: Record<string, number> = {};
  materialBlindDamagedCounts: Record<string, number> = {};

  showMyGateTicketView = false;
  loadingMyGateTicket = false;
  sendingParticipantNotification = false;

  activeHiringAccordionRole = '';

  hiringInvitationCounts: Partial<Record<HireableRole, number>> = {};

  private pendingHiringRestore: { role: HireableRole; search: string } | null = null;

  private hiringContextRestored = false;

  private participantsArrivalOrdersEnsured = false;

  private static readonly HIRING_PANEL_STATE_KEY = 'eventDetailHiringPanelState';

  updatingPaymentId = '';
  resolvingProfileId = '';
  reviewProfile: ParticipationReviewProfile | null = null;
  reviewProfileOpen = false;
  loadingReviewProfile = false;

  readonly hireableRoles = HIREABLE_ROLES;
  readonly anonymousParticipantRoles = EVENT_REGISTRATION_ROLES;

  addingAnonymous = false;
  /** Admin: faltam goleiros perto do fim das inscricoes. */
  goalkeeperShortageWarning = '';
  private goalkeeperAlertShownForEventId = '';

  @ViewChild(IonContent) private content?: IonContent;

  @ViewChildren(EventRoleHiringPanelComponent)
  hiringPanels!: QueryList<EventRoleHiringPanelComponent>;

  voteScores: Record<string, number> = {};
  participantSearch = '';

  voteScoreOptions = Array.from({ length: 11 }, (_, index) => index);
  savingVotes = false;
  votesSubmitted = false;
  loadingVotes = false;
  activeSocioUserIds = new Set<string>();
  hasSavedTeamSplit = false;
  hasScoutApontamento = false;
  myGateTicket: EventGateTicket | null = null;
  issuingTicketId = '';
  cancellingTicketId = '';

  performanceForm = this.fb.group({
    userId: ['', Validators.required],
    role: ['athlete' as MuralTargetRole, Validators.required],
    goals: [0, [Validators.min(0)]],
    assists: [0, [Validators.min(0)]],
    saves: [0, [Validators.min(0)]],
    yellowCards: [0, [Validators.min(0)]],
    redCards: [0, [Validators.min(0)]],
  });

  savingPerformance = false;

  adminForm = this.fb.group({

    registrationOpenDate: ['', Validators.required],

    registrationOpenTime: ['', Validators.required],

    registrationCloseDate: ['', Validators.required],

    registrationCloseTime: ['', Validators.required],

    useArrivalOrderForTeams: [false],

    isFinished: [false],

    votingOpenDate: [''],
    votingOpenTime: [''],
    votingCloseDate: [''],
    votingCloseTime: [''],

    sumulaOpenDate: [''],
    sumulaOpenTime: [''],
    sumulaCloseDate: [''],
    sumulaCloseTime: [''],

    scoutOpenDate: [''],
    scoutOpenTime: [''],
    scoutCloseDate: [''],
    scoutCloseTime: [''],

    gateTicketControlEnabled: [false],

    maxAthletesPerEvent: [0, [Validators.min(0)]],

    participationFee: [0, [Validators.min(0)]],
    pixKey1: [''],
    pixKey2: [''],
    pixKey3: [''],

  });



  constructor(

    private readonly route: ActivatedRoute,

    private readonly router: Router,

    private readonly fb: FormBuilder,

    readonly eventService: EventService,

    readonly registrationService: RegistrationService,

    private readonly performanceService: EventPerformanceService,
    private readonly muralService: MuralService,
    private readonly membershipService: PeladaMembershipService,
    private readonly peladaService: PeladaService,
    private readonly teamSplitService: TeamSplitService,
    private readonly scoutApontamentoService: ScoutApontamentoService,
    private readonly gateTicketService: EventGateTicketService,
    private readonly invitationService: RefereeInvitationService,
    private readonly profilePresentationRequestService: ProfilePresentationRequestService,
    private readonly materialInventoryService: MaterialInventoryService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.registrationsChangedSub = this.registrationService.onRegistrationsChanged.subscribe(() => {
      void this.refreshRegistrationState();
    });
  }

  ngOnDestroy(): void {
    this.registrationsChangedSub?.unsubscribe();
  }

  get votingTargets(): EventRegistrationListItem[] {
    const source = this.isAdmin ? this.participants : this.confirmedParticipants;
    const eligible = source.filter((participant) => participant.role !== 'fan');
    const currentUserId = Parse.User.current()?.id?.trim() || '';
    // Uma entrada por usuario (nao por perfil/inscricao duplicada). Anti auto-voto.
    const byUser = new Map<string, EventRegistrationListItem>();
    for (const participant of eligible) {
      const userId = participant.userId?.trim();
      if (!userId) continue;
      if (currentUserId && userId === currentUserId) continue;
      if (!byUser.has(userId)) {
        byUser.set(userId, participant);
      }
    }
    return Array.from(byUser.values());
  }

  get voteableParticipants(): EventRegistrationListItem[] {
    return this.participants.filter((participant) => participant.role !== 'fan');
  }

  get athleteParticipants(): EventRegistrationListItem[] {
    return this.participants.filter((participant) => participant.role === 'athlete');
  }

  onParticipantSearchChange(value: string): void {
    this.participantSearch = value;
    this.refreshFilteredParticipants();
    this.cdr.markForCheck();
  }

  private refreshFilteredParticipants(): void {
    const query = normalizeSearchText(this.participantSearch);
    if (!query) {
      this.filteredParticipants = this.participants;
      this.filteredConfirmedParticipants = this.confirmedParticipants;
      return;
    }

    this.filteredParticipants = this.participants.filter((participant) => {
      const haystack = normalizeSearchText(
        `${participant.apelido} ${participant.userName} ${this.registrationService.formatRole(participant.role)} ${participant.primaryPosition ?? ''}`
      );
      return haystack.includes(query);
    });

    this.filteredConfirmedParticipants = this.confirmedParticipants.filter((participant) => {
      const haystack = normalizeSearchText(
        `${participant.apelido} ${participant.userName} ${this.registrationService.formatRole(participant.role)} ${participant.primaryPosition ?? ''}`
      );
      return haystack.includes(query);
    });
  }

  private refreshUiState(): void {
    if (this.event) {
      this.eventOverview = buildEventDetailOverviewViewModel(this.event, this.eventService, {
        registrationsOpen: this.registrationsOpen,
        registrationStatusLabel: this.registrationStatusLabel,
        supportsArrivalOrder: this.supportsArrivalOrder,
        pixKeys: this.pixKeys,
      });
      this.votingPeriodLabels = buildEventVotingPeriodLabels(this.event);
    } else {
      this.eventOverview = null;
      this.votingPeriodLabels = null;
    }

    this.refreshFilteredParticipants();
    const pendingProfileCount = this.participants.filter(
      (participant) => participant.profilePresentationStatus === 'pending'
    ).length;
    const participantsLabel =
      pendingProfileCount > 0
        ? `Participantes (${this.participants.length}) · ${pendingProfileCount} apresentacao(oes)`
        : `Participantes (${this.participants.length})`;
    this.adminActionTileRows = this.buildActionTileRows([
      {
        id: 'settings',
        label: 'Configuracoes do evento',
        icon: 'settings-outline',
        visible: true,
        active: this.showAdminPanel,
      },
      {
        id: 'participants',
        label: participantsLabel,
        icon: 'people-outline',
        visible: true,
        active: this.showParticipantsPanel,
      },
      {
        id: 'notify-participants',
        label: 'Notificar participantes',
        icon: 'notifications-outline',
        visible: this.canNotifyConfirmedParticipants,
      },
      {
        id: 'hiring',
        label: 'Negociacao/Contratacoes',
        icon: 'briefcase-outline',
        visible: true,
        active: this.showHiringPanel,
      },
      {
        id: 'material',
        label: 'Material',
        icon: 'shirt-outline',
        visible: !!this.event?.peladaId,
        active: this.showMaterialPanel,
      },
      {
        id: 'anonymous',
        label: 'Adicionar participante anonimo',
        icon: 'person-add-outline',
        visible: true,
      },
      {
        id: 'team-split',
        label: this.teamSplitButtonLabel,
        icon: 'git-network-outline',
        visible: this.showTeamSplitButton,
      },
      {
        id: 'predictions',
        label: 'Fazer palpites',
        icon: 'bulb-outline',
        visible: this.canMakePredictions,
      },
      {
        id: 'gate',
        label: 'Portaria',
        icon: 'key-outline',
        visible:
          this.gateTicketControlEnabled &&
          (this.canManageGateTools || this.canViewMyGateTicket),
        active: this.showGatePanel,
      },
      {
        id: 'voting',
        label: 'Votacao do evento',
        icon: 'star-outline',
        visible: this.canShowEventVoting,
        active: this.showVotingPanel,
      },
      {
        id: 'mural',
        label: 'Ver mural do evento',
        icon: 'newspaper-outline',
        visible: true,
      },
    ]);

    this.userActionTileRows = this.buildActionTileRows([
      {
        id: 'participants',
        label: this.userParticipantsButtonLabel,
        icon: 'people-outline',
        visible: this.canShowUserParticipantsButton,
        active: this.showParticipantsPanel,
      },
      {
        id: 'scout',
        label: this.canEditScoutApontamento ? 'Apontamento scout' : 'Consultar apontamento scout',
        icon: 'clipboard-outline',
        visible: this.canViewScoutApontamento,
      },
      {
        id: 'narrator-radio',
        label: 'Radio',
        icon: 'radio-outline',
        visible: this.canAccessNarratorRadio,
      },
      {
        id: 'journalist-journal',
        label: 'Jornal',
        icon: 'newspaper-outline',
        visible: this.canAccessJournalistJournal,
      },
      {
        id: 'cameraman-coverage',
        label: 'Cobertura',
        icon: 'videocam-outline',
        visible: this.canAccessCameramanCoverage,
      },
      {
        id: 'gandula-duty',
        label: 'Apoio em campo',
        icon: 'football-outline',
        visible: this.canAccessGandulaDuty,
      },
      {
        id: 'sumula',
        label: this.sumulaActionLabel,
        icon: 'document-text-outline',
        visible: this.canViewRefereeSumula,
      },
      {
        id: 'material',
        label: 'Material',
        icon: 'shirt-outline',
        visible: this.isEventKitman,
        active: this.showMaterialPanel,
      },
      {
        id: 'predictions',
        label: 'Fazer palpites',
        icon: 'bulb-outline',
        visible: this.canMakePredictions,
      },
      {
        id: 'fan-checkin',
        label: 'Check-in da torcida',
        icon: 'heart-outline',
        visible: this.canAccessFanCheckIn,
      },
      {
        id: 'coach-board',
        label: 'Painel do treinador',
        icon: 'football-outline',
        visible: this.canAccessCoachBoard,
      },
      {
        id: 'physical-trainer',
        label: 'Preparacao fisica',
        icon: 'barbell-outline',
        visible: this.canAccessPhysicalTrainer,
      },
      {
        id: 'masseur-treatments',
        label: 'Atendimentos',
        icon: 'medkit-outline',
        visible: this.canAccessMasseurTreatments,
      },
      {
        id: 'team-split',
        label: this.teamSplitButtonLabel,
        icon: 'git-network-outline',
        visible: this.showTeamSplitButton,
      },
      {
        id: 'gate',
        label: 'Portaria',
        icon: 'key-outline',
        visible:
          (this.canManageGateTools || this.showParticipantGatePortaria) &&
          this.gateTicketControlEnabled,
        active: this.showGatePanel,
      },
      {
        id: 'voting',
        label: 'Votacao do evento',
        icon: 'star-outline',
        visible: this.canShowEventVoting,
        active: this.showVotingPanel,
      },
      {
        id: 'mural',
        label: 'Ver mural do evento',
        icon: 'newspaper-outline',
        visible: true,
      },
    ]);

    this.gateActionTileRows = this.buildActionTileRows([
      {
        id: 'gate-ticket',
        label: 'Visualizar ingresso',
        icon: 'ticket-outline',
        visible: this.isAdmin || this.canViewMyGateTicket,
        active: this.showMyGateTicketView,
      },
      {
        id: 'gate-scan',
        label: 'Ler ingresso',
        icon: 'qr-code-outline',
        visible: this.canManageGateTools,
      },
      {
        id: 'gate-entries',
        label: 'Participantes que ingressaram',
        icon: 'enter-outline',
        visible: this.canManageGateTools,
      },
    ]);
  }

  ionViewWillEnter(): void {
    this.captureHiringRestoreIntent();
    if (this.pendingHiringRestore) {
      this.hiringContextRestored = false;
    }
    const eventId = this.route.snapshot.paramMap.get('id');
    const isInitialLoad = !this.event || this.event.objectId !== eventId;

    if (isInitialLoad) {
      this.hiringContextRestored = false;
      this.participantsArrivalOrdersEnsured = false;
      this.resetInlinePanels();
      void this.load().then(() => {
        this.restoreHiringPanelStateFromSession(eventId);
        void this.applyPendingHiringRestore();
      });
      return;
    }

    if (!isInitialLoad) {
      void this.refreshParticipantsList();
    }

    this.restoreHiringPanelStateFromSession(eventId);
    void this.applyPendingHiringRestore();
  }

  ionViewDidEnter(): void {
    this.captureHiringRestoreIntent();
  }

  ionViewWillLeave(): void {
    this.persistHiringPanelState();
  }

  get supportsArrivalOrder(): boolean {

    return !!this.event && supportsArrivalOrder(this.event.type);

  }



  get registrationsOpen(): boolean {

    return !!this.event && this.eventService.areRegistrationsOpen(this.event);

  }



  get registrationStatusLabel(): string {

    return this.event ? this.eventService.registrationStatusLabel(this.event) : '';

  }

  get gateTicketControlEnabled(): boolean {
    return !!this.event?.gateTicketControlEnabled;
  }

  get isGatekeeper(): boolean {
    return this.registration?.role === 'gatekeeper' && !!this.registration?.isEffectivelyConfirmed;
  }

  get canManageGateTools(): boolean {
    return !!this.event && (this.isAdmin || this.isGatekeeper);
  }

  get lockParticipationFee(): boolean {
    return this.participants.some(
      (participant) => participant.isEffectivelyConfirmed && !participant.paymentExempt
    );
  }

  get showParticipantGatePortaria(): boolean {
    return this.canViewMyGateTicket && !this.isAdmin;
  }

  get canViewMyGateTicket(): boolean {
    if (!this.registration || !this.gateTicketControlEnabled) {
      return false;
    }
    if (this.registration.role === 'gatekeeper' && this.registration.isEffectivelyConfirmed) {
      return false;
    }
    return true;
  }

  get canAccessNarratorRadio(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'narrator' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canAccessJournalistJournal(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'journalist' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canAccessCameramanCoverage(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'cameraman' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canAccessGandulaDuty(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'gandula' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canNotifyConfirmedParticipants(): boolean {
    return this.isAdmin && this.confirmedParticipants.length > 0;
  }

  get canShowEventVoting(): boolean {
    return !!(
      this.registration?.isEffectivelyConfirmed &&
      this.votingTargets.length > 0
    );
  }

  get canShowUserParticipantsButton(): boolean {
    return !this.isAdmin && (!!this.registration || this.confirmedParticipants.length > 0);
  }

  get userParticipantsButtonLabel(): string {
    const count = Math.max(this.confirmedParticipants.length, this.registration ? 1 : 0);
    return `Participantes (${count})`;
  }

  get pixKeys(): string[] {

    if (!this.event) return [];

    return [this.event.pixKey1, this.event.pixKey2, this.event.pixKey3].filter((key) => !!key?.trim());

  }

  get canMakePredictions(): boolean {

    return !!this.event && new Date() < this.event.startTime;

  }

  get canAccessFanCheckIn(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'fan' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canAccessCoachBoard(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'coach' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canAccessPhysicalTrainer(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'physical_trainer' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canAccessMasseurTreatments(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'masseur' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canSeparateTeams(): boolean {
    return !!this.event && (this.event.type === 'pelada' || this.event.type === 'racha');
  }

  get isEventFinished(): boolean {
    return !!this.event && isEventEnded(this.event);
  }

  get showTeamSplitButton(): boolean {
    if (!this.canSeparateTeams) return false;
    if (this.isAdmin) return true;
    return this.isEventFinished && this.hasSavedTeamSplit;
  }

  get teamSplitButtonLabel(): string {
    if (!this.isEventFinished) return 'Separacao de times';
    if (this.isAdmin && this.event?.allowTeamSplitAfterEventEnd) return 'Separacao de times';
    return 'Consultar separacao de times';
  }

  get canEditScoutApontamento(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'scout' &&
      this.registration.isEffectivelyConfirmed &&
      this.event &&
      !this.event.isFinished
    );
  }

  get canViewScoutApontamento(): boolean {
    return !!(
      this.registration &&
      this.registration.isEffectivelyConfirmed &&
      this.event &&
      (this.canEditScoutApontamento || this.hasScoutApontamento)
    );
  }

  /** @deprecated use canEditScoutApontamento */
  get canAccessScoutApontamento(): boolean {
    return this.canEditScoutApontamento;
  }

  get canAccessRefereeSumula(): boolean {
    return !!(
      this.registration &&
      this.registration.role === 'referee' &&
      this.registration.isEffectivelyConfirmed &&
      this.event
    );
  }

  get canViewRefereeSumula(): boolean {
    if (!this.event) return false;
    if (this.isAdmin) return true;
    if (!this.registration?.isEffectivelyConfirmed) return false;
    if (this.isEventFinished) return true;
    return this.registration.role === 'referee';
  }

  get sumulaActionLabel(): string {
    if (!this.event) return 'Sumula do evento';
    if (this.isEventFinished) return 'Consultar sumula do evento';
    if (
      this.registration?.role === 'referee' &&
      this.registration.isEffectivelyConfirmed &&
      isSumulaEditOpen(this.event)
    ) {
      return 'Sumula do evento';
    }
    if (this.registration?.role === 'referee') {
      return 'Sumula do evento';
    }
    return 'Consultar sumula do evento';
  }

  get canVote(): boolean {
    return !!(
      this.event &&
      this.registration?.isEffectivelyConfirmed &&
      isVotingOpen(this.event) &&
      !this.votesSubmitted
    );
  }

  get votingStatusLabel(): string {
    return this.event ? getVotingStatusLabel(this.event) : '';
  }

  get votingWindow() {
    return this.event ? getEffectiveVotingWindow(this.event) : null;
  }

  get votingUsesDefault(): boolean {
    return !!this.votingWindow?.usesDefault;
  }

  get votingPeriodNote(): string {
    if (!this.votingWindow) {
      return '';
    }
    return `${this.votingStatusLabel} · ${this.formatDate(this.votingWindow.opensAt)} — ${this.formatDate(this.votingWindow.closesAt)}`;
  }

  formatDate(date: Date): string {

    return new Intl.DateTimeFormat('pt-BR', {

      weekday: 'short',

      day: '2-digit',

      month: 'short',

      year: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

    }).format(date);

  }



  formatParticipationFee(fee: number): string {

    return this.eventService.formatParticipationFee(fee);

  }

  goBack(): void {

    if (this.event?.peladaId) {
      void this.router.navigate(['/pelada', this.event.peladaId]);
    } else {
      void this.router.navigateByUrl('/tabs/peladas');
    }

  }

  openMural(): void {
    if (!this.event) return;
    void this.router.navigate(['/event', this.event.objectId, 'mural']);
  }

  openScoutApontamento(): void {
    if (!this.event || !this.canViewScoutApontamento) return;
    void this.router.navigate(['/event', this.event.objectId, 'scout']);
  }

  openRefereeSumula(): void {
    if (!this.event || !this.canViewRefereeSumula) return;
    void this.router.navigate(['/event', this.event.objectId, 'sumula']);
  }

  openNarratorRadio(): void {
    if (!this.event || !this.canAccessNarratorRadio) return;
    void this.router.navigate(['/event', this.event.objectId, 'narrator-radio']);
  }

  openJournalistJournal(): void {
    if (!this.event || !this.canAccessJournalistJournal) return;
    void this.router.navigate(['/event', this.event.objectId, 'journalist-journal']);
  }

  openCameramanCoverage(): void {
    if (!this.event || !this.canAccessCameramanCoverage) return;
    void this.router.navigate(['/event', this.event.objectId, 'cameraman-coverage']);
  }

  async openGandulaDutyInfo(): Promise<void> {
    if (!this.canAccessGandulaDuty) return;
    await this.showInfo(
      'Voce esta confirmado como gandula neste evento. ' +
        'Apoie a busca de bolas e o fluxo de jogo em campo. ' +
        'Sua presenca aparece na lista de participantes.'
    );
  }

  openPredictions(): void {
    if (!this.event) return;
    void this.router.navigate(['/event', this.event.objectId, 'predictions']);
  }

  openFanCheckIn(): void {
    if (!this.event || !this.canAccessFanCheckIn) return;
    void this.router.navigate(['/event', this.event.objectId, 'fan-checkin']);
  }

  openCoachBoard(): void {
    if (!this.event || !this.canAccessCoachBoard) return;
    void this.router.navigate(['/event', this.event.objectId, 'coach-board']);
  }

  openPhysicalTrainer(): void {
    if (!this.event || !this.canAccessPhysicalTrainer) return;
    void this.router.navigate(['/event', this.event.objectId, 'physical-trainer']);
  }

  openMasseurTreatments(): void {
    if (!this.event || !this.canAccessMasseurTreatments) return;
    void this.router.navigate(['/event', this.event.objectId, 'masseur-treatments']);
  }

  openTeamSplit(): void {
    if (!this.event || !this.showTeamSplitButton) return;
    void this.router.navigate(['/event', this.event.objectId, 'team-split']);
  }

  openPelada(): void {
    if (!this.event?.peladaId) return;
    void this.router.navigate(['/pelada', this.event.peladaId]);
  }

  async savePerformance(): Promise<void> {
    if (!this.event || this.performanceForm.invalid) return;
    const v = this.performanceForm.getRawValue();
    this.savingPerformance = true;
    try {
      await this.performanceService.upsert({
        eventId: this.event.objectId,
        userId: v.userId!,
        role: v.role!,
        goals: Number(v.goals ?? 0),
        assists: Number(v.assists ?? 0),
        saves: Number(v.saves ?? 0),
        yellowCards: Number(v.yellowCards ?? 0),
        redCards: Number(v.redCards ?? 0),
      });
      await this.showSuccess('Desempenho registrado.');
      this.performanceForm.reset({
        userId: '',
        role: 'athlete',
        goals: 0,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
      });
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao salvar desempenho.');
    } finally {
      this.savingPerformance = false;
    }
  }



  participate(): void {

    if (!this.event || this.event.isReadOnly || !this.registrationsOpen) return;

    void this.router.navigate(['/event', this.event.objectId, 'register']);

  }



  openGateScan(): void {
    if (!this.event) return;
    void this.router.navigate(['/event', this.event.objectId, 'gate-scan']);
  }

  openGateEntries(): void {
    if (!this.event) return;
    void this.router.navigate(['/event', this.event.objectId, 'gate-entries']);
  }

  async issueGateTicket(participant: EventRegistrationListItem): Promise<void> {
    if (!this.event || !this.isAdmin) return;
    this.issuingTicketId = participant.objectId;
    try {
      await this.gateTicketService.issueTicket(this.event.objectId, participant.objectId);
      this.participants = await this.registrationService.listForEvent(this.event.objectId);
      if (this.registration?.objectId === participant.objectId) {
        await this.loadMyGateTicket();
      }
      await this.showSuccess(
        `Ingresso enviado para ${participant.apelido || participant.userName} com sucesso.`
      );
    } catch (error: unknown) {
      await this.showError(
        parseErrorMessage(error) || 'Nao foi possivel enviar o ingresso. Tente novamente.'
      );
    } finally {
      this.issuingTicketId = '';
      this.cdr.markForCheck();
    }
  }

  async cancelGateTicket(participant: EventRegistrationListItem): Promise<void> {
    if (!this.event || !this.isAdmin) return;
    this.cancellingTicketId = participant.objectId;
    try {
      await this.gateTicketService.cancelTicket(this.event.objectId, participant.objectId);
      this.participants = await this.registrationService.listForEvent(this.event.objectId);
      if (this.registration?.objectId === participant.objectId) {
        this.myGateTicket = null;
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.cancellingTicketId = '';
      this.cdr.markForCheck();
    }
  }

  get showAdminActionButtons(): boolean {
    return !this.hasAdminInlinePanelOpen;
  }

  get showUserActionButtons(): boolean {
    return !this.hasUserInlinePanelOpen;
  }

  private get hasAdminInlinePanelOpen(): boolean {
    return (
      this.showParticipantsPanel ||
      this.showAdminPanel ||
      this.showHiringPanel ||
      this.showGatePanel ||
      this.showVotingPanel ||
      this.showMaterialPanel
    );
  }

  private get hasUserInlinePanelOpen(): boolean {
    return (
      this.showParticipantsPanel ||
      this.showGatePanel ||
      this.showVotingPanel ||
      this.showMaterialPanel
    );
  }

  get isEventKitman(): boolean {
    return this.registration?.role === 'kitman';
  }

  closeParticipantsPanel(): void {
    this.showParticipantsPanel = false;
    this.refreshUiState();
    this.cdr.markForCheck();
    setTimeout(() => this.scrollToActionButtons(), 100);
  }

  closeAdminSettingsPanel(): void {
    this.showAdminPanel = false;
    this.refreshUiState();
    this.cdr.markForCheck();
    setTimeout(() => this.scrollToActionButtons(), 100);
  }

  closeHiringPanel(): void {
    this.showHiringPanel = false;
    this.activeHiringAccordionRole = '';
    this.persistHiringPanelState();
    this.refreshUiState();
    this.cdr.markForCheck();
    setTimeout(() => this.scrollToActionButtons(), 100);
  }

  closeGatePanel(): void {
    this.showGatePanel = false;
    this.showMyGateTicketView = false;
    this.refreshUiState();
    this.cdr.markForCheck();
    setTimeout(() => this.scrollToActionButtons(), 100);
  }

  closeVotingPanel(): void {
    this.showVotingPanel = false;
    this.refreshUiState();
    this.cdr.markForCheck();
    setTimeout(() => this.scrollToActionButtons(), 100);
  }

  closeGateTicketView(): void {
    this.showMyGateTicketView = false;
    this.refreshUiState();
    this.cdr.markForCheck();
    void this.scrollToAnchor('gate-panel-anchor');
  }

  toggleAdminPanel(): void {
    if (this.showAdminPanel) {
      this.closeAdminSettingsPanel();
      return;
    }
    this.closeAdminInlinePanelsExcept('settings');
    this.showAdminPanel = true;
    this.refreshUiState();
    this.cdr.markForCheck();
    void this.scrollToAnchor('admin-settings-panel-anchor');
  }

  toggleHiringPanel(): void {
    if (this.showHiringPanel) {
      this.closeHiringPanel();
      this.persistHiringPanelState();
      return;
    }
    this.closeAdminInlinePanelsExcept('hiring');
    this.showHiringPanel = true;
    void this.refreshHiringInvitationCounts();
    this.persistHiringPanelState();
    this.refreshUiState();
    this.cdr.markForCheck();
    void this.scrollToAnchor('hiring-panel-anchor');
  }

  pinHiringAccordion(role: HireableRole): void {
    if (!HIREABLE_ROLES.includes(role)) return;

    this.showHiringPanel = true;
    this.activeHiringAccordionRole = role;
    this.persistHiringPanelState();
    const panel = this.hiringPanels?.find((item) => item.role === role);
    void panel?.ensureExpandedLoad();
    this.cdr.markForCheck();
  }

  onHiringInvitationCountsChanged(): void {
    void this.refreshHiringInvitationCounts();
  }

  toggleGatePanel(): void {
    if (this.showGatePanel) {
      this.closeGatePanel();
      return;
    }
    this.refreshUiState();
    const hasGateActions = this.gateActionTileRows.some((row) => row.length > 0);
    if (!hasGateActions && !this.canViewMyGateTicket) {
      void this.showInfo('Nenhuma acao de portaria disponivel no momento.');
      return;
    }
    if (this.isAdmin) {
      this.closeAdminInlinePanelsExcept('gate');
    } else {
      this.closeUserInlinePanelsExcept('gate');
    }
    this.showGatePanel = true;
    this.refreshUiState();
    this.cdr.markForCheck();
    if (this.shouldAutoOpenMyGateTicket()) {
      void this.viewMyGateTicket();
      return;
    }
    void this.scrollToGatePanel();
  }

  toggleVotingPanel(): void {
    if (this.showVotingPanel) {
      this.closeVotingPanel();
      return;
    }
    if (this.isAdmin) {
      this.closeAdminInlinePanelsExcept('voting');
    } else {
      this.closeUserInlinePanelsExcept('voting');
    }
    this.showVotingPanel = true;
    this.refreshUiState();
    this.cdr.markForCheck();
    void this.scrollToAnchor('voting-panel-anchor');
  }

  toggleParticipantsPanel(): void {
    if (this.showParticipantsPanel) {
      this.closeParticipantsPanel();
      return;
    }
    if (this.isAdmin) {
      this.closeAdminInlinePanelsExcept('participants');
    } else {
      this.closeUserInlinePanelsExcept('participants');
    }
    this.showParticipantsPanel = true;
    void this.ensureParticipantsArrivalOrders();
    this.refreshUiState();
    this.cdr.markForCheck();
    void this.scrollToAnchor('participants-panel-anchor');
  }

  private closeAdminInlinePanelsExcept(
    except: 'participants' | 'settings' | 'hiring' | 'gate' | 'voting' | 'material'
  ): void {
    if (except !== 'participants') this.showParticipantsPanel = false;
    if (except !== 'settings') this.showAdminPanel = false;
    if (except !== 'hiring') this.showHiringPanel = false;
    if (except !== 'gate') {
      this.showGatePanel = false;
      this.showMyGateTicketView = false;
    }
    if (except !== 'voting') this.showVotingPanel = false;
    if (except !== 'material') this.showMaterialPanel = false;
  }

  private closeUserInlinePanelsExcept(
    except: 'participants' | 'gate' | 'voting' | 'material'
  ): void {
    if (except !== 'participants') this.showParticipantsPanel = false;
    if (except !== 'gate') {
      this.showGatePanel = false;
      this.showMyGateTicketView = false;
    }
    if (except !== 'voting') this.showVotingPanel = false;
    if (except !== 'material') this.showMaterialPanel = false;
  }

  closeMaterialPanel(): void {
    this.showMaterialPanel = false;
    this.refreshUiState();
    this.cdr.markForCheck();
    setTimeout(() => this.scrollToActionButtons(), 100);
  }

  toggleMaterialPanel(): void {
    if (this.showMaterialPanel) {
      this.closeMaterialPanel();
      return;
    }
    if (this.isAdmin) {
      this.closeAdminInlinePanelsExcept('material');
    } else {
      this.closeUserInlinePanelsExcept('material');
    }
    this.showMaterialPanel = true;
    this.refreshUiState();
    this.cdr.markForCheck();
    void this.loadMaterialPanelData();
    void this.scrollToAnchor('material-panel-anchor');
  }

  private scrollToActionButtons(): void {
    const anchorId = this.isAdmin ? 'admin-action-buttons' : 'user-action-buttons';
    void this.scrollToAnchor(anchorId);
  }

  private async scrollToAnchor(anchorId: string, topOffset = 16): Promise<boolean> {
    if (!this.content) return false;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const target = document.getElementById(anchorId);
    if (!target) return false;
    const scrollElement = await this.content.getScrollElement();
    const contentRect = scrollElement.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollTop = scrollElement.scrollTop + (targetRect.top - contentRect.top) - topOffset;
    await this.content.scrollToPoint(0, Math.max(0, scrollTop), 300);
    return true;
  }

  private hiringRoleSearchAnchorId(role: HireableRole): string {
    return `hiring-role-search-${role}`;
  }

  private isAnchorVisible(anchorId: string): boolean {
    const target = document.getElementById(anchorId);
    if (!target) {
      return false;
    }
    const rect = target.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) {
      return false;
    }
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.top < viewportHeight - 24 && rect.bottom > 80;
  }

  private async scrollToHiringRoleSearch(role: HireableRole): Promise<void> {
    const anchorId = this.hiringRoleSearchAnchorId(role);
    await this.scrollToAnchor('hiring-panel-anchor', 8);

    for (let attempt = 0; attempt < 15; attempt++) {
      const delay = attempt === 0 ? 120 : attempt < 5 ? 150 : 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.cdr.detectChanges();
      if (!this.isAnchorVisible(anchorId)) {
        continue;
      }
      const scrolled = await this.scrollToAnchor(anchorId, 24);
      if (scrolled) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        await this.scrollToAnchor(anchorId, 24);
        return;
      }
    }
  }

  handleAdminAction(actionId: string): void {
    switch (actionId) {
      case 'settings':
        this.toggleAdminPanel();
        break;
      case 'participants':
        this.toggleParticipantsPanel();
        break;
      case 'notify-participants':
        void this.promptNotifyConfirmedParticipants();
        break;
      case 'hiring':
        this.toggleHiringPanel();
        break;
      case 'material':
        this.toggleMaterialPanel();
        break;
      case 'anonymous':
        void this.promptAddAnonymousParticipant();
        break;
      case 'team-split':
        this.openTeamSplit();
        break;
      case 'predictions':
        this.openPredictions();
        break;
      case 'gate':
        this.toggleGatePanel();
        break;
      case 'voting':
        this.toggleVotingPanel();
        break;
      case 'mural':
        this.openMural();
        break;
    }
  }

  handleUserAction(actionId: string): void {
    switch (actionId) {
      case 'participants':
        this.toggleParticipantsPanel();
        break;
      case 'scout':
        this.openScoutApontamento();
        break;
      case 'narrator-radio':
        this.openNarratorRadio();
        break;
      case 'journalist-journal':
        this.openJournalistJournal();
        break;
      case 'cameraman-coverage':
        this.openCameramanCoverage();
        break;
      case 'gandula-duty':
        void this.openGandulaDutyInfo();
        break;
      case 'sumula':
        this.openRefereeSumula();
        break;
      case 'material':
        this.toggleMaterialPanel();
        break;
      case 'predictions':
        this.openPredictions();
        break;
      case 'fan-checkin':
        this.openFanCheckIn();
        break;
      case 'coach-board':
        this.openCoachBoard();
        break;
      case 'physical-trainer':
        this.openPhysicalTrainer();
        break;
      case 'masseur-treatments':
        this.openMasseurTreatments();
        break;
      case 'team-split':
        this.openTeamSplit();
        break;
      case 'gate':
        this.toggleGatePanel();
        break;
      case 'voting':
        this.toggleVotingPanel();
        break;
      case 'mural':
        this.openMural();
        break;
    }
  }

  handleGateAction(actionId: string): void {
    switch (actionId) {
      case 'gate-scan':
        this.openGateScan();
        break;
      case 'gate-entries':
        this.openGateEntries();
        break;
      case 'gate-ticket':
        void this.viewMyGateTicket();
        break;
    }
  }

  onGateTicketQrRendered(): void {
    void this.scrollToGateTicketView();
  }

  private buildActionTileRows(tiles: EventDetailActionTile[]): EventDetailActionTile[][] {
    const visible = tiles.filter((tile) => tile.visible);
    const rows: EventDetailActionTile[][] = [];
    for (let index = 0; index < visible.length; index += 2) {
      rows.push(visible.slice(index, index + 2));
    }
    return rows;
  }

  formatGateTicketLocation(ticket: EventGateTicket | null): string {
    if (ticket?.eventLocation?.trim()) return ticket.eventLocation.trim();
    if (!this.event) return '';
    const address = this.eventService.formatAddress(this.event.address);
    const complement = this.event.locationComplement?.trim();
    return complement ? `${address} — ${complement}` : address;
  }

  async viewMyGateTicket(): Promise<void> {
    if (!this.event) return;
    if (!this.registration) {
      await this.showInfo('Voce nao esta inscrito neste evento. Inscreva-se para visualizar seu ingresso.');
      return;
    }
    this.loadingMyGateTicket = true;
    this.showMyGateTicketView = true;
    this.refreshUiState();
    this.cdr.markForCheck();
    try {
      await this.loadMyGateTicket();
      this.refreshUiState();
      this.cdr.markForCheck();
      await this.scrollToGateTicketView();
      if (!this.myGateTicket?.active) {
        await this.showInfo('Ingresso ainda nao foi emitido pelo administrador.');
      }
    } catch (error: unknown) {
      this.showMyGateTicketView = false;
      this.refreshUiState();
      await this.showError(
        parseErrorMessage(error) || 'Nao foi possivel carregar o ingresso. Tente novamente.'
      );
    } finally {
      this.loadingMyGateTicket = false;
      this.cdr.markForCheck();
    }
  }

  async promptNotifyConfirmedParticipants(): Promise<void> {
    if (!this.event || !this.canNotifyConfirmedParticipants || this.sendingParticipantNotification) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Notificar participantes',
      message:
        'A mensagem sera enviada para inscritos confirmados neste evento que autorizaram notificacoes no app.',
      inputs: [
        {
          name: 'title',
          type: 'text',
          placeholder: 'Titulo da mensagem',
        },
        {
          name: 'message',
          type: 'textarea',
          placeholder: 'Mensagem de notificacao',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar',
          handler: (data) => {
            void this.sendParticipantNotification(String(data?.title || ''), String(data?.message || ''));
          },
        },
      ],
    });
    await alert.present();
  }

  private async sendParticipantNotification(title: string, message: string): Promise<void> {
    if (!this.event) return;
    const normalizedTitle = title.trim();
    const normalizedMessage = message.trim();
    if (normalizedTitle.length < 2) {
      await this.showError('Informe o titulo da notificacao.');
      return;
    }
    if (normalizedMessage.length < 2) {
      await this.showError('Informe a mensagem da notificacao.');
      return;
    }

    this.sendingParticipantNotification = true;
    const loading = await this.loadingCtrl.create({ message: 'Enviando notificacoes...' });
    await loading.present();
    try {
      const result = await this.pushNotificationService.sendEventConfirmedParticipantNotification(
        this.event.objectId,
        normalizedTitle,
        normalizedMessage
      );
      if (result.devicesMatched <= 0) {
        await this.showError(
          `Nenhum aparelho com notificacoes ativas foi encontrado entre ${result.targetedUsers} participante(s) confirmado(s). Peça ao participante para abrir o app logado e autorizar notificacoes novamente.`
        );
        return;
      }
      await this.showSuccess(
        `Notificacao enviada para ${result.devicesMatched} aparelho(s) de ${result.targetedUsers} participante(s) confirmado(s).`
      );
    } catch (error: unknown) {
      await this.showError(
        parseErrorMessage(error) || 'Nao foi possivel enviar a notificacao. Tente novamente.'
      );
    } finally {
      this.sendingParticipantNotification = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  private shouldAutoOpenMyGateTicket(): boolean {
    return this.canViewMyGateTicket && !this.canManageGateTools;
  }

  private async scrollToGatePanel(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = attempt === 0 ? 80 : 120;
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.cdr.detectChanges();
      const scrolled = await this.scrollToAnchor('gate-panel-anchor', 12);
      if (scrolled && this.isAnchorVisible('gate-panel-anchor')) {
        return;
      }
    }
  }

  private async scrollToGateTicketView(): Promise<void> {
    await this.scrollToGatePanel();
    for (let attempt = 0; attempt < 12; attempt++) {
      const delay = attempt === 0 ? 100 : 140;
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.cdr.detectChanges();
      const scrolled = await this.scrollToAnchor('gate-ticket-panel-anchor', 12);
      if (scrolled && this.isAnchorVisible('gate-ticket-panel-anchor')) {
        return;
      }
    }
  }



  async saveAdminSettings(): Promise<void> {

    if (!this.event || this.adminForm.invalid) {

      this.adminForm.markAllAsTouched();

      return;

    }



    const v = this.adminForm.getRawValue();

    const registrationOpensAt = this.combineDateTime(

      v.registrationOpenDate!,

      v.registrationOpenTime!

    );

    const registrationClosesAt = this.combineDateTime(

      v.registrationCloseDate!,

      v.registrationCloseTime!

    );

    const hasVotingOpen = !!v.votingOpenDate && !!v.votingOpenTime;
    const hasVotingClose = !!v.votingCloseDate && !!v.votingCloseTime;
    if (hasVotingOpen !== hasVotingClose) {
      await this.showError(
        'Informe data e hora de abertura e encerramento da votacao, ou deixe ambos em branco.'
      );
      return;
    }

    let votingOpensAt: Date | null = null;
    let votingClosesAt: Date | null = null;
    if (hasVotingOpen && hasVotingClose) {
      votingOpensAt = this.combineDateTime(v.votingOpenDate!, v.votingOpenTime!);
      votingClosesAt = this.combineDateTime(v.votingCloseDate!, v.votingCloseTime!);
      if (votingClosesAt <= votingOpensAt) {
        await this.showError('O encerramento da votacao deve ser apos a abertura.');
        return;
      }
    }

    const sumulaPeriod = this.readOptionalPeriod(
      v.sumulaOpenDate,
      v.sumulaOpenTime,
      v.sumulaCloseDate,
      v.sumulaCloseTime,
      'sumula'
    );
    if (sumulaPeriod.error) {
      await this.showError(sumulaPeriod.error);
      return;
    }

    const scoutPeriod = this.readOptionalPeriod(
      v.scoutOpenDate,
      v.scoutOpenTime,
      v.scoutCloseDate,
      v.scoutCloseTime,
      'apontamento scout'
    );
    if (scoutPeriod.error) {
      await this.showError(scoutPeriod.error);
      return;
    }

    const participationFee = this.lockParticipationFee
      ? Math.max(0, Number(this.event?.participationFee ?? 0))
      : Math.max(0, Number(v.participationFee ?? 0));
    const pixKey1 = String(v.pixKey1 ?? '').trim();
    const pixKey2 = String(v.pixKey2 ?? '').trim();
    const pixKey3 = String(v.pixKey3 ?? '').trim();
    if (!this.lockParticipationFee && participationFee > 0 && !hasPixKey(pixKey1, pixKey2, pixKey3)) {
      await this.showError('Informe ao menos uma chave PIX quando o valor da participacao for maior que zero.');
      return;
    }

    this.savingAdmin = true;

    const loading = await this.loadingCtrl.create({ message: 'Salvando...' });

    await loading.present();



    try {

      const gateWasEnabled = !!this.event.gateTicketControlEnabled;

      this.event = await this.eventService.updateAdminSettings(this.event.objectId, {

        registrationOpensAt,

        registrationClosesAt,

        useArrivalOrderForTeams: !!v.useArrivalOrderForTeams,

        isFinished: !!v.isFinished,

        votingOpensAt: hasVotingOpen ? votingOpensAt : null,
        votingClosesAt: hasVotingOpen ? votingClosesAt : null,

        sumulaOpensAt: sumulaPeriod.opensAt,
        sumulaClosesAt: sumulaPeriod.closesAt,
        scoutApontamentoOpensAt: scoutPeriod.opensAt,
        scoutApontamentoClosesAt: scoutPeriod.closesAt,
        gateTicketControlEnabled: !!v.gateTicketControlEnabled,
        maxAthletesPerEvent: Number(v.maxAthletesPerEvent ?? 0),
        participationFee,
        pixKey1,
        pixKey2,
        pixKey3,

      });

      const gateJustEnabled = !!this.event.gateTicketControlEnabled && !gateWasEnabled;
      if (gateJustEnabled) {
        if (this.isAdmin) {
          this.participants = await this.registrationService.listForEvent(this.event.objectId);
        }
        if (this.registration?.isEffectivelyConfirmed) {
          await this.loadMyGateTicket();
        }
      }

      this.patchAdminForm(this.event);
      this.refreshUiState();
      this.cdr.markForCheck();

      this.showAdminPanel = false;

    } catch (error: unknown) {

      await this.showError(parseErrorMessage(error));

    } finally {

      this.savingAdmin = false;

      await loading.dismiss();

    }

  }



  async onPaymentExemptToggle(participant: EventRegistrationListItem, event: CustomEvent): Promise<void> {
    if (!this.event || !this.isAdmin) return;

    const paymentExempt = !!event.detail.checked;
    this.updatingPaymentId = participant.objectId;

    try {
      const updated = await this.registrationService.setPaymentExempt(
        this.event.objectId,
        participant.objectId,
        paymentExempt
      );
      this.applyParticipantUpdate(updated);
      if (this.event.gateTicketControlEnabled && updated.isEffectivelyConfirmed) {
        await this.loadMyGateTicket();
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
      this.participants = [...this.participants];
    } finally {
      this.updatingPaymentId = '';
    }
  }

  async onArrivalAction(
    participant: EventRegistrationListItem,
    action: 'check_in' | 'undo'
  ): Promise<void> {
    if (!this.event || !this.isAdmin) return;

    this.updatingPaymentId = participant.objectId;
    try {
      this.participants = await this.registrationService.registerAthleteArrival(
        this.event.objectId,
        participant.objectId,
        action
      );
      await this.loadActiveSocioUserIds();
      this.confirmedParticipants = this.participants.filter((item) => item.isEffectivelyConfirmed);
      this.sortParticipantsForArrivalDisplay();
      this.cdr.markForCheck();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.updatingPaymentId = '';
    }
  }

  async submitEventVotes(): Promise<void> {
    if (!this.event) return;

    if (this.votesSubmitted) {
      await this.showError('Sua votacao ja foi registrada e nao pode ser alterada.');
      return;
    }

    if (!this.canVote) {
      await this.showError('A votacao nao esta aberta no momento.');
      return;
    }

    const entries = this.votingTargets.filter(
      (participant) => this.voteScores[participant.objectId] != null
    );

    if (!entries.length) {
      await this.showError('Atribua nota de 0 a 10 para ao menos um participante.');
      return;
    }

    this.savingVotes = true;
    try {
      const ballotVotes = entries
        .map((participant) => {
          const muralRole = eventRegistrationVoteMuralRole(
            participant.role,
            participant.primaryPosition
          );
          if (!muralRole) return null;
          return {
            eventId: this.event!.objectId,
            registrationId: participant.objectId,
            targetRole: muralRole,
            score: Number(this.voteScores[participant.objectId] ?? 0),
            period: this.event!.objectId,
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row);

      await this.muralService.submitEventMuralBallot({
        eventId: this.event.objectId,
        period: this.event.objectId,
        votes: ballotVotes,
      });

      this.votesSubmitted = true;
      await this.loadVoteScores();

      const alert = await this.alertCtrl.create({
        header: 'Votacao',
        message: 'Suas notas foram registradas.',
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.savingVotes = false;
    }
  }

  onHiringAccordionChange(event: CustomEvent): void {
    const role = this.parseHiringAccordionValue(event.detail?.value);
    if (role) {
      this.pinHiringAccordion(role);
      return;
    }

    if (this.activeHiringAccordionRole && this.showHiringPanel) {
      const pinnedRole = this.activeHiringAccordionRole;
      setTimeout(() => {
        if (!this.showHiringPanel) return;
        if (this.activeHiringAccordionRole !== pinnedRole) {
          this.activeHiringAccordionRole = pinnedRole;
          this.cdr.markForCheck();
        }
      }, 0);
    }
  }

  private parseHiringAccordionValue(value: unknown): HireableRole | undefined {
    if (typeof value === 'string') {
      const role = value.trim();
      return HIREABLE_ROLES.includes(role as HireableRole) ? (role as HireableRole) : undefined;
    }

    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        const entry = value[index];
        if (typeof entry === 'string' && HIREABLE_ROLES.includes(entry as HireableRole)) {
          return entry as HireableRole;
        }
      }
    }

    return undefined;
  }

  private async refreshHiringInvitationCounts(): Promise<void> {
    if (!this.event?.objectId) {
      this.hiringInvitationCounts = {};
      return;
    }

    try {
      const invitations = await this.invitationService.listForEvent(this.event.objectId);
      const counts: Partial<Record<HireableRole, number>> = {};
      for (const invitation of invitations) {
        const role = invitation.role as HireableRole;
        if (!HIREABLE_ROLES.includes(role)) continue;
        counts[role] = (counts[role] ?? 0) + 1;
      }
      this.hiringInvitationCounts = counts;
    } catch (error: unknown) {
      console.warn('Falha ao carregar contagem de convites por perfil', error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private captureHiringRestoreIntent(): void {
    const eventId = this.route.snapshot.paramMap.get('id') ?? this.event?.objectId;
    const expectedReturnUrl = eventId ? `/event/${eventId}` : undefined;
    const panel = this.route.snapshot.queryParamMap.get('panel');
    const queryRole = this.route.snapshot.queryParamMap.get('role') as HireableRole | null;
    const querySearch = this.route.snapshot.queryParamMap.get('search') ?? '';

    if (panel === 'hiring' && queryRole && HIREABLE_ROLES.includes(queryRole)) {
      this.pendingHiringRestore = { role: queryRole, search: querySearch };
      return;
    }

    const stored = peekProfileReturnNavigationState(expectedReturnUrl);
    if (stored?.hiringRole) {
      this.pendingHiringRestore = {
        role: stored.hiringRole,
        search: stored.hiringSearch ?? '',
      };
    }
  }

  private async applyPendingHiringRestore(): Promise<void> {
    if (
      this.hiringContextRestored ||
      this.loading ||
      !this.pendingHiringRestore ||
      !this.isAdmin ||
      !this.event
    ) {
      return;
    }

    const { role, search } = this.pendingHiringRestore;
    if (!HIREABLE_ROLES.includes(role)) {
      return;
    }

    this.hiringContextRestored = true;
    this.pendingHiringRestore = null;
    consumeProfileReturnNavigationState(`/event/${this.event.objectId}`);

    this.closeAdminInlinePanelsExcept('hiring');
    this.showHiringPanel = true;
    this.activeHiringAccordionRole = role;
    void this.refreshHiringInvitationCounts();
    this.cdr.markForCheck();

    await new Promise((resolve) => setTimeout(resolve, 80));

    const hiringPanel = await this.findHiringPanelWithRetry(role);
    if (!hiringPanel) {
      return;
    }

    await hiringPanel.ensureExpandedLoad();
    await hiringPanel.restoreSearch(search);
    this.cdr.markForCheck();
    await this.scrollToHiringRoleSearch(role);

    if (this.route.snapshot.queryParamMap.get('panel') === 'hiring') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { panel: null, role: null, search: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private async findHiringPanelWithRetry(
    role: HireableRole
  ): Promise<EventRoleHiringPanelComponent | undefined> {
    for (let attempt = 0; attempt < 30; attempt++) {
      this.cdr.detectChanges();
      const panel = this.hiringPanels?.find((item) => item.role === role);
      if (panel) {
        return panel;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return undefined;
  }

  async promptAddAnonymousParticipant(): Promise<void> {
    if (!this.event || !this.isAdmin || this.addingAnonymous) return;

    const alert = await this.alertCtrl.create({
      header: 'Participante anonimo',
      message:
        'Use para quem ainda nao tem o app instalado ou surgiu para completar a pelada. A inscricao entra confirmada e isenta.',
      inputs: [
        {
          name: 'apelido',
          type: 'text',
          placeholder: 'Apelido',
        },
        {
          name: 'role',
          type: 'text',
          placeholder: 'Perfil (athlete, scout, fan...)',
          value: 'athlete',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Adicionar',
          handler: (data: { apelido?: string; role?: string }) => {
            void this.addAnonymousParticipant(data.apelido ?? '', data.role ?? 'athlete');
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  formatAnonymousRole(role: ProfileRole): string {
    return PROFILE_ROLE_LABELS[role] || role;
  }

  private async addAnonymousParticipant(rawApelido: string, rawRole: string): Promise<void> {
    if (!this.event) return;

    const apelido = rawApelido.trim();
    const role = (rawRole.trim() || 'athlete') as ProfileRole;
    if (apelido.length < 2) {
      await this.showError('Informe um apelido com pelo menos 2 caracteres.');
      return;
    }
    if (!EVENT_REGISTRATION_ROLES.includes(role)) {
      await this.showError('Perfil invalido. Use athlete, scout, fan, referee, etc.');
      return;
    }

    this.addingAnonymous = true;
    try {
      const created = await this.registrationService.createAnonymousRegistration(
        this.event.objectId,
        apelido,
        role
      );
      this.participants = [...this.participants, created];
      this.confirmedParticipants = this.participants.filter((item) => item.isEffectivelyConfirmed);
      this.sortParticipantsForArrivalDisplay();
      await this.refreshGoalkeeperShortageWarning();
      this.cdr.markForCheck();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.addingAnonymous = false;
    }
  }

  private applyParticipantUpdate(updated: EventRegistrationListItem): void {
    this.participants = this.participants.map((item) =>
      item.objectId === updated.objectId ? updated : item
    );
    this.confirmedParticipants = this.participants.filter((item) => item.isEffectivelyConfirmed);
    if (this.registration?.objectId === updated.objectId) {
      this.registration = updated;
    }
    void this.refreshGoalkeeperShortageWarning();
  }

  private sortParticipantsForArrivalDisplay(): void {
    if (!this.event?.useArrivalOrderForTeams || !this.supportsArrivalOrder) {
      return;
    }

    const adminId = this.event.adminId;
    this.participants = [...this.participants].sort((a, b) => {
      const aAthlete = a.role === 'athlete';
      const bAthlete = b.role === 'athlete';

      if (aAthlete && bAthlete) {
        const aArrived = a.arrivedAt != null;
        const bArrived = b.arrivedAt != null;
        if (aArrived && bArrived) {
          return compareArrivalParticipants(a, b, adminId, this.activeSocioUserIds);
        }
        if (aArrived !== bArrived) {
          return aArrived ? -1 : 1;
        }

        return compareArrivalParticipants(
          { ...a, arrivedAt: undefined, arrivalOrder: undefined },
          { ...b, arrivedAt: undefined, arrivalOrder: undefined },
          adminId,
          this.activeSocioUserIds
        );
      }

      if (aAthlete !== bAthlete) {
        return aAthlete ? -1 : 1;
      }

      return a.apelido.localeCompare(b.apelido, 'pt-BR');
    });
  }

  private async loadActiveSocioUserIds(): Promise<void> {
    this.activeSocioUserIds = new Set<string>();
    if (!this.event?.peladaId) {
      return;
    }

    const members = await this.membershipService.listActiveForDisplay(this.event.peladaId);
    this.activeSocioUserIds = new Set(members.map((member) => member.userId));
  }

  async onPaymentToggle(participant: EventRegistrationListItem, event: CustomEvent): Promise<void> {

    if (!this.event || !this.isAdmin) return;



    const paymentConfirmed = !!event.detail.checked;

    this.updatingPaymentId = participant.objectId;



    try {

      const updated = await this.registrationService.setPaymentConfirmed(

        this.event.objectId,

        participant.objectId,

        paymentConfirmed

      );

      this.applyParticipantUpdate(updated);
      if (this.event.gateTicketControlEnabled && updated.isEffectivelyConfirmed) {
        await this.loadMyGateTicket();
      }

    } catch (error: unknown) {

      await this.showError(parseErrorMessage(error));

      this.participants = [...this.participants];

    } finally {

      this.updatingPaymentId = '';

    }

  }

  async onViewProfilePresentation(participant: EventRegistrationListItem): Promise<void> {
    if (!this.event?.peladaId || !this.isAdmin) return;

    this.reviewProfileOpen = true;
    this.loadingReviewProfile = true;
    this.reviewProfile = null;
    this.cdr.markForCheck();
    try {
      this.reviewProfile = await this.profilePresentationRequestService.getReviewProfile(
        this.event.peladaId,
        participant.userId
      );
      if (!this.reviewProfile) {
        this.reviewProfileOpen = false;
        await this.showError('Perfil nao encontrado.');
      }
    } catch (error: unknown) {
      this.reviewProfileOpen = false;
      await this.showError(parseErrorMessage(error));
    } finally {
      this.loadingReviewProfile = false;
      this.cdr.markForCheck();
    }
  }

  closeProfilePresentationReview(): void {
    this.reviewProfileOpen = false;
    this.reviewProfile = null;
  }

  formatReviewLocation(profile: ParticipationReviewProfile): string {
    return [profile.neighborhood, profile.city, profile.state].filter(Boolean).join(' · ');
  }

  async onApproveProfilePresentation(participant: EventRegistrationListItem): Promise<void> {
    await this.resolveProfilePresentation(participant, 'approve');
  }

  async onMaterialSourceChange(source: EventMaterialSource): Promise<void> {
    if (!this.event) return;
    this.materialBusy = true;
    this.cdr.markForCheck();
    try {
      this.materialSession = await this.materialInventoryService.setEventSource(
        this.event.objectId,
        source
      );
      this.materialPartialQuantities = {};
      this.materialBlindCounts = {};
      this.materialBlindDamagedCounts = {};
      await this.refreshMaterialInventoryForSession();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.materialBusy = false;
      this.refreshUiState();
      this.cdr.markForCheck();
    }
  }

  async onMaterialLoadAll(): Promise<void> {
    if (!this.event) return;
    this.materialBusy = true;
    this.cdr.markForCheck();
    try {
      this.materialSession = await this.materialInventoryService.loadEventMaterial(
        this.event.objectId,
        'all'
      );
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.materialBusy = false;
      this.cdr.markForCheck();
    }
  }

  async onMaterialLoadPartial(): Promise<void> {
    if (!this.event) return;
    const lines = Object.entries(this.materialPartialQuantities)
      .map(([inventoryItemId, quantity]) => ({
        inventoryItemId,
        quantity: Number(quantity) || 0,
      }))
      .filter((row) => row.quantity > 0);
    if (!lines.length) {
      await this.showError('Informe ao menos uma quantidade parcial.');
      return;
    }
    this.materialBusy = true;
    this.cdr.markForCheck();
    try {
      this.materialSession = await this.materialInventoryService.loadEventMaterial(
        this.event.objectId,
        'partial',
        lines
      );
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.materialBusy = false;
      this.cdr.markForCheck();
    }
  }

  async onMaterialSend(): Promise<void> {
    if (!this.event) return;
    this.materialBusy = true;
    this.cdr.markForCheck();
    try {
      this.materialSession = await this.materialInventoryService.sendEventMaterial(
        this.event.objectId
      );
      await this.showInfo('Material enviado para conferencia.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.materialBusy = false;
      this.cdr.markForCheck();
    }
  }

  async onMaterialSubmitBlindCount(): Promise<void> {
    if (!this.event || !this.materialSession) return;
    const missingLines = this.materialSession.lines.filter((line) => {
      const key = `${line.itemType}::${(line.color || '').trim().toLowerCase()}`;
      const raw = this.materialBlindCounts[key];
      return raw === undefined || raw === null || String(raw).trim() === '';
    });
    if (missingLines.length) {
      await this.showError('Informe a quantidade contada em todas as linhas antes de enviar a contagem cega.');
      return;
    }
    const counts = this.materialSession.lines.map((line) => {
      const key = `${line.itemType}::${(line.color || '').trim().toLowerCase()}`;
      const quantity = Math.max(0, Number(this.materialBlindCounts[key]));
      const damagedQuantity = Math.min(
        quantity,
        Math.max(0, Number(this.materialBlindDamagedCounts[key] ?? 0))
      );
      return {
        itemType: line.itemType as MaterialItemType,
        color: line.color || '',
        quantity,
        damagedQuantity,
      };
    });
    this.materialBusy = true;
    this.cdr.markForCheck();
    try {
      this.materialSession = await this.materialInventoryService.submitBlindCount(
        this.event.objectId,
        counts
      );
      await this.refreshMaterialInventoryForSession();
      await this.showInfo('Contagem cega registrada. Avarias atualizadas no cadastro.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.materialBusy = false;
      this.cdr.markForCheck();
    }
  }

  async onMaterialReceiveReturn(): Promise<void> {
    if (!this.event || !this.materialSession) return;
    const counts = this.materialSession.lines.map((line) => {
      const key = `${line.itemType}::${(line.color || '').trim().toLowerCase()}`;
      const fromBlind = this.materialBlindCounts[key];
      const quantity =
        fromBlind != null
          ? Number(fromBlind)
          : line.quantityBlindCounted != null
            ? Number(line.quantityBlindCounted)
            : Number(line.quantitySent || line.quantityLoaded || 0);
      const fromDamaged = this.materialBlindDamagedCounts[key];
      const damagedQuantity =
        fromDamaged != null
          ? Math.min(quantity, Number(fromDamaged))
          : line.quantityDamagedCounted != null
            ? Math.min(quantity, Number(line.quantityDamagedCounted))
            : 0;
      return {
        itemType: line.itemType as MaterialItemType,
        color: line.color || '',
        quantity,
        damagedQuantity,
      };
    });
    this.materialBusy = true;
    this.cdr.markForCheck();
    try {
      this.materialSession = await this.materialInventoryService.receiveEventMaterialReturn(
        this.event.objectId,
        counts
      );
      await this.refreshMaterialInventoryForSession();
      await this.showInfo('Devolucao registrada.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.materialBusy = false;
      this.cdr.markForCheck();
    }
  }

  async onMaterialApplyLosses(): Promise<void> {
    if (!this.event) return;
    const alert = await this.alertCtrl.create({
      header: 'Aplicar baixas',
      message:
        'Atualizar o cadastro de material da pelada com as faltas/perdas encontradas nas divergencias?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aplicar',
          role: 'destructive',
          handler: () => {
            void this.applyMaterialLossesConfirmed();
          },
        },
      ],
    });
    await alert.present();
  }

  onMaterialPartialQuantityChange(payload: { id: string; quantity: number }): void {
    this.materialPartialQuantities = {
      ...this.materialPartialQuantities,
      [payload.id]: payload.quantity,
    };
    this.cdr.markForCheck();
  }

  onMaterialBlindCountChange(payload: { key: string; quantity: number }): void {
    this.materialBlindCounts = {
      ...this.materialBlindCounts,
      [payload.key]: payload.quantity,
    };
    this.cdr.markForCheck();
  }

  onMaterialBlindDamagedChange(payload: { key: string; quantity: number }): void {
    this.materialBlindDamagedCounts = {
      ...this.materialBlindDamagedCounts,
      [payload.key]: payload.quantity,
    };
    this.cdr.markForCheck();
  }

  private async applyMaterialLossesConfirmed(): Promise<void> {
    if (!this.event) return;
    this.materialBusy = true;
    this.cdr.markForCheck();
    try {
      this.materialSession = await this.materialInventoryService.applyMaterialLosses(
        this.event.objectId
      );
      await this.refreshMaterialInventoryForSession();
      await this.showInfo('Baixas aplicadas no material da pelada.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.materialBusy = false;
      this.cdr.markForCheck();
    }
  }

  private async loadMaterialPanelData(): Promise<void> {
    if (!this.event) return;
    try {
      this.materialSession = await this.materialInventoryService.getEventSession(
        this.event.objectId
      );
      await this.refreshMaterialInventoryForSession();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async refreshMaterialInventoryForSession(): Promise<void> {
    if (!this.event || !this.materialSession) {
      this.materialInventory = [];
      this.materialPartialQuantities = {};
      return;
    }
    const source = this.materialSession.materialSource;
    // Lista apenas o inventario que o ator atual pode carregar parcialmente.
    if (source === 'pelada' && this.isAdmin && this.event.peladaId) {
      try {
        this.materialInventory = await this.materialInventoryService.listInventory({
          ownerType: 'pelada',
          peladaId: this.event.peladaId,
        });
      } catch {
        this.materialInventory = [];
      }
      this.prefillMaterialEventQuantities();
      return;
    }
    if (source === 'kitman' && this.isEventKitman) {
      try {
        this.materialInventory = await this.materialInventoryService.listInventory({
          ownerType: 'kitman',
        });
      } catch {
        this.materialInventory = [];
      }
      this.prefillMaterialEventQuantities();
      return;
    }
    this.materialInventory = [];
    this.materialPartialQuantities = {};
  }

  /** Sugere Qtd.Evento = disponivel; o usuario pode reduzir. */
  private prefillMaterialEventQuantities(): void {
    const next: Record<string, number> = {};
    for (const item of this.materialInventory) {
      if (item.availableQuantity > 0) {
        next[item.objectId] = item.availableQuantity;
      }
    }
    this.materialPartialQuantities = next;
  }

  async onRejectProfilePresentation(participant: EventRegistrationListItem): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Recusar solicitacao',
      message: `Recusar a participacao de ${participant.apelido} neste evento?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Recusar',
          role: 'destructive',
          handler: () => {
            void this.resolveProfilePresentation(participant, 'reject');
          },
        },
      ],
    });
    await alert.present();
  }

  private async resolveProfilePresentation(
    participant: EventRegistrationListItem,
    action: 'approve' | 'reject'
  ): Promise<void> {
    if (!this.event?.peladaId || !this.isAdmin) return;

    this.resolvingProfileId = participant.objectId;
    this.cdr.markForCheck();
    try {
      await this.profilePresentationRequestService.resolve(
        this.event.peladaId,
        participant.objectId,
        action
      );
      await this.refreshParticipantsList();
      const alert = await this.alertCtrl.create({
        header: 'OK',
        message: action === 'approve' ? 'Participacao aprovada.' : 'Solicitacao recusada.',
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.resolvingProfileId = '';
      this.cdr.markForCheck();
    }
  }

  async confirmCancelRegistration(): Promise<void> {

    if (!this.event || !this.registration || this.event.isReadOnly || this.cancelling) return;



    const alert = await this.alertCtrl.create({

      header: 'Cancelar inscricao',

      message: 'Tem certeza que deseja cancelar sua inscricao neste evento?',

      buttons: [

        { text: 'Nao', role: 'cancel' },

        {

          text: 'Sim, cancelar',

          role: 'destructive',

          handler: () => {

            void this.cancelRegistration();

          },

        },

      ],

    });

    await alert.present();

  }



  private async cancelRegistration(): Promise<void> {

    if (!this.event) return;



    this.cancelling = true;

    const loading = await this.loadingCtrl.create({ message: 'Cancelando inscricao...' });

    await loading.present();



    try {

      await this.registrationService.cancelRegistration(this.event.objectId);

      this.registration = null;

      if (this.isAdmin) {

        this.participants = await this.registrationService.listForEvent(this.event.objectId);

      }

    } catch (error: unknown) {

      await this.showError(parseErrorMessage(error));

    } finally {

      this.cancelling = false;

      await loading.dismiss();

    }

  }



  private resetInlinePanels(): void {
    this.showParticipantsPanel = false;
    this.showAdminPanel = false;
    this.showHiringPanel = false;
    this.showGatePanel = false;
    this.showMyGateTicketView = false;
    this.showVotingPanel = false;
    this.showMaterialPanel = false;
    this.materialSession = null;
    this.materialInventory = [];
    this.materialPartialQuantities = {};
    this.materialBlindCounts = {};
    this.materialBlindDamagedCounts = {};
  }

  private async refreshRegistrationState(): Promise<void> {
    const eventId = this.event?.objectId ?? this.route.snapshot.paramMap.get('id');
    if (!eventId) return;
    try {
      this.registration = await this.registrationService.getForEvent(eventId);
      await this.loadMyGateTicket();
      await this.refreshParticipantsList();
      this.refreshUiState();
      this.cdr.markForCheck();
    } catch {
      // mantem estado atual
    }
  }

  private async refreshParticipantsList(): Promise<void> {
    const eventId = this.event?.objectId ?? this.route.snapshot.paramMap.get('id');
    if (!eventId || !this.event) return;

    try {
      if (this.isAdmin) {
        this.participants = await this.registrationService.listForEvent(eventId);
        this.confirmedParticipants = this.participants.filter((item) => item.isEffectivelyConfirmed);
        this.sortParticipantsForArrivalDisplay();
      } else {
        this.participants = [];
        this.confirmedParticipants = await this.registrationService.listPublicForEvent(eventId);
      }
      this.refreshFilteredParticipants();
      this.refreshUiState();
      this.cdr.markForCheck();
    } catch {
      // mantem lista atual
    }
  }

  private async load(): Promise<void> {

    const eventId = this.route.snapshot.paramMap.get('id');

    if (!eventId) {

      await this.showError('Evento nao encontrado.');

      this.goBack();

      return;

    }

    this.loading = true;
    this.cdr.markForCheck();

    try {

      const [event, registration] = await Promise.all([
        this.eventService.getById(eventId),
        this.registrationService.getForEvent(eventId),
      ]);

      this.event = event ? await this.enrichEventPeladaSettings(event) : null;
      this.registration = registration;

      if (!this.event) {

        await this.showError('Evento nao encontrado.');

        this.goBack();

        return;

      }

      this.isAdmin = this.eventService.isCurrentUserAdmin(this.event);
      this.patchAdminForm(this.event);
      this.loading = false;
      this.refreshUiState();
      this.cdr.markForCheck();

      await this.loadSecondaryEventData(eventId);

    } catch (error: unknown) {

      const message = error instanceof Error ? error.message : 'Erro ao carregar evento.';

      await this.showError(message);

      this.goBack();

    } finally {

      this.loading = false;
      this.refreshUiState();
      this.cdr.markForCheck();

    }

  }

  private async enrichEventPeladaSettings(event: PeladaEvent): Promise<PeladaEvent> {
    if (!event.peladaId) return event;

    try {
      const pelada = await this.peladaService.getById(event.peladaId);
      if (!pelada) return event;

      return {
        ...event,
        allowTeamSplitAfterEventEnd: !!pelada.allowTeamSplitAfterEventEnd,
      };
    } catch {
      return event;
    }
  }

  private async loadSecondaryEventData(eventId: string): Promise<void> {
    if (!this.event) return;

    const parallelTasks: Promise<unknown>[] = [
      this.loadMyGateTicket(),
      this.loadActiveSocioUserIds(),
      this.teamSplitService.getSavedSplit(eventId).then((saved) => {
        this.hasSavedTeamSplit = !!saved?.teams?.some((team) => team.length > 0);
      }),
      this.scoutApontamentoService.hasSavedApontamento(eventId).then((has) => {
        this.hasScoutApontamento = has;
      }),
    ];

    await Promise.all(parallelTasks);

    if (this.isAdmin) {
      this.participants = await this.registrationService.listForEvent(eventId);
      this.confirmedParticipants = this.participants.filter((item) => item.isEffectivelyConfirmed);
      this.sortParticipantsForArrivalDisplay();
      await this.refreshGoalkeeperShortageWarning();
    } else {
      this.participants = [];
      this.confirmedParticipants = await this.registrationService.listPublicForEvent(eventId);
      this.goalkeeperShortageWarning = '';
    }

    this.refreshUiState();
    this.cdr.markForCheck();
    void this.loadVoteScores();
  }

  private countConfirmedGoalkeepers(): number {
    return this.participants.filter(
      (item) =>
        item.isEffectivelyConfirmed &&
        item.role === 'athlete' &&
        isGoalkeeperPosition(item.primaryPosition)
    ).length;
  }

  private async refreshGoalkeeperShortageWarning(): Promise<void> {
    if (!this.event || !this.isAdmin) {
      this.goalkeeperShortageWarning = '';
      return;
    }

    const status = getRegistrationStatus(
      this.event.registrationOpensAt,
      this.event.registrationClosesAt
    );
    if (status !== 'open') {
      this.goalkeeperShortageWarning = '';
      return;
    }

    const msLeft = this.event.registrationClosesAt.getTime() - Date.now();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    if (msLeft > fortyEightHoursMs || msLeft < 0) {
      this.goalkeeperShortageWarning = '';
      return;
    }

    const goalkeeperCount = this.countConfirmedGoalkeepers();
    if (goalkeeperCount >= 2) {
      this.goalkeeperShortageWarning = '';
      return;
    }

    const missing = 2 - goalkeeperCount;
    this.goalkeeperShortageWarning =
      goalkeeperCount === 0
        ? `Atencao: as inscricoes encerram em breve e nao ha goleiro confirmado (minimo 2). Contrate/convide um atleta goleiro em Negociacao/Contratacoes ou adicione um participante anonimo.`
        : `Atencao: as inscricoes encerram em breve e ha apenas ${goalkeeperCount} goleiro confirmado (faltam ${missing} para o minimo de 2). Contrate/convide ou adicione participante anonimo.`;

    if (this.goalkeeperAlertShownForEventId !== this.event.objectId) {
      this.goalkeeperAlertShownForEventId = this.event.objectId;
      const alert = await this.alertCtrl.create({
        header: 'Goleiros insuficientes',
        message: this.goalkeeperShortageWarning,
        buttons: [
          {
            text: 'Negociacao',
            handler: () => {
              this.pinHiringAccordion('athlete');
              void this.scrollToAnchor('hiring-panel-anchor');
            },
          },
          {
            text: 'Participante anonimo',
            handler: () => {
              void this.promptAddAnonymousParticipant();
            },
          },
          { text: 'OK', role: 'cancel' },
        ],
      });
      await alert.present();
    }
  }

  private async ensureParticipantsArrivalOrders(): Promise<void> {
    if (
      !this.event ||
      !this.isAdmin ||
      this.participantsArrivalOrdersEnsured ||
      !this.event.useArrivalOrderForTeams ||
      !this.supportsArrivalOrder
    ) {
      return;
    }

    try {
      await this.registrationService.ensureArrivalOrders(this.event.objectId);
      this.participantsArrivalOrdersEnsured = true;
      this.participants = await this.registrationService.listForEvent(this.event.objectId);
      this.confirmedParticipants = this.participants.filter((item) => item.isEffectivelyConfirmed);
      this.sortParticipantsForArrivalDisplay();
      this.refreshUiState();
      this.cdr.markForCheck();
    } catch (error: unknown) {
      console.warn('Falha ao preparar ordem de chegada dos participantes', error);
    }
  }

  private persistHiringPanelState(): void {
    if (!this.event?.objectId) return;

    const payload = {
      eventId: this.event.objectId,
      showHiringPanel: this.showHiringPanel,
      activeHiringAccordionRole: this.activeHiringAccordionRole,
    };

    try {
      sessionStorage.setItem(EventDetailPage.HIRING_PANEL_STATE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota / privacy mode
    }
  }

  private restoreHiringPanelStateFromSession(eventId: string | null): void {
    if (!eventId || this.pendingHiringRestore) return;

    try {
      const raw = sessionStorage.getItem(EventDetailPage.HIRING_PANEL_STATE_KEY);
      if (!raw) return;

      const state = JSON.parse(raw) as {
        eventId?: string;
        showHiringPanel?: boolean;
        activeHiringAccordionRole?: HireableRole | '';
      };

      if (state.eventId !== eventId || !state.showHiringPanel) return;

      this.showHiringPanel = true;
      const restoredRole = this.parseHiringAccordionValue(state.activeHiringAccordionRole);
      if (restoredRole) {
        this.activeHiringAccordionRole = restoredRole;
        const panel = this.hiringPanels?.find((item) => item.role === restoredRole);
        void panel?.ensureExpandedLoad();
      }
      this.cdr.markForCheck();
    } catch {
      sessionStorage.removeItem(EventDetailPage.HIRING_PANEL_STATE_KEY);
    }
  }



  private async loadVoteScores(): Promise<void> {
    if (!this.event) return;

    this.loadingVotes = true;
    try {
      const myVotes = await this.muralService.listMyVotesForEvent(this.event.objectId);
      this.voteScores = {};
      this.votesSubmitted = myVotes.length > 0;

      for (const participant of this.votingTargets) {
        const muralRole = eventRegistrationVoteMuralRole(
          participant.role,
          participant.primaryPosition
        );
        if (!muralRole) continue;

        const existing = myVotes.find((vote) => {
          if (vote.targetUserId !== participant.userId) return false;
          if (vote.targetRole === muralRole) return true;
          if (muralRole === 'goalkeeper' && vote.targetRole === 'athlete') return true;
          return false;
        });
        if (existing) {
          this.voteScores[participant.objectId] = existing.score;
        }
      }
    } finally {
      this.loadingVotes = false;
      this.cdr.markForCheck();
    }
  }

  private patchAdminForm(event: PeladaEvent): void {

    this.adminForm.patchValue({

      registrationOpenDate: this.toDateInput(event.registrationOpensAt),

      registrationOpenTime: this.toTimeInput(event.registrationOpensAt),

      registrationCloseDate: this.toDateInput(event.registrationClosesAt),

      registrationCloseTime: this.toTimeInput(event.registrationClosesAt),

      useArrivalOrderForTeams: event.useArrivalOrderForTeams,

      isFinished: event.isFinished,

      votingOpenDate: event.votingOpensAt ? this.toDateInput(event.votingOpensAt) : '',
      votingOpenTime: event.votingOpensAt ? this.toTimeInput(event.votingOpensAt) : '',
      votingCloseDate: event.votingClosesAt ? this.toDateInput(event.votingClosesAt) : '',
      votingCloseTime: event.votingClosesAt ? this.toTimeInput(event.votingClosesAt) : '',

      sumulaOpenDate: event.sumulaOpensAt ? this.toDateInput(event.sumulaOpensAt) : '',
      sumulaOpenTime: event.sumulaOpensAt ? this.toTimeInput(event.sumulaOpensAt) : '',
      sumulaCloseDate: event.sumulaClosesAt ? this.toDateInput(event.sumulaClosesAt) : '',
      sumulaCloseTime: event.sumulaClosesAt ? this.toTimeInput(event.sumulaClosesAt) : '',

      scoutOpenDate: event.scoutApontamentoOpensAt ? this.toDateInput(event.scoutApontamentoOpensAt) : '',
      scoutOpenTime: event.scoutApontamentoOpensAt ? this.toTimeInput(event.scoutApontamentoOpensAt) : '',
      scoutCloseDate: event.scoutApontamentoClosesAt ? this.toDateInput(event.scoutApontamentoClosesAt) : '',
      scoutCloseTime: event.scoutApontamentoClosesAt ? this.toTimeInput(event.scoutApontamentoClosesAt) : '',

      gateTicketControlEnabled: !!event.gateTicketControlEnabled,

      maxAthletesPerEvent: event.maxAthletesPerEvent ?? 0,

      participationFee: event.participationFee ?? 0,
      pixKey1: event.pixKey1 ?? '',
      pixKey2: event.pixKey2 ?? '',
      pixKey3: event.pixKey3 ?? '',

    });

  }

  private async loadMyGateTicket(): Promise<void> {
    if (!this.event?.gateTicketControlEnabled || !this.registration?.isEffectivelyConfirmed) {
      this.myGateTicket = null;
      return;
    }
    try {
      this.myGateTicket = await this.gateTicketService.getMyTicket(this.event.objectId);
    } catch {
      this.myGateTicket = null;
    }
  }

  private readOptionalPeriod(
    openDate?: string | null,
    openTime?: string | null,
    closeDate?: string | null,
    closeTime?: string | null,
    label?: string
  ): { opensAt: Date | null; closesAt: Date | null; error?: string } {
    const hasOpen = !!openDate && !!openTime;
    const hasClose = !!closeDate && !!closeTime;
    if (!hasOpen && !hasClose) {
      return { opensAt: null, closesAt: null };
    }
    if (hasOpen !== hasClose) {
      return {
        opensAt: null,
        closesAt: null,
        error: `Informe data e hora de abertura e encerramento do periodo de ${label}, ou deixe ambos em branco.`,
      };
    }
    const opensAt = this.combineDateTime(openDate!, openTime!);
    const closesAt = this.combineDateTime(closeDate!, closeTime!);
    if (closesAt <= opensAt) {
      return {
        opensAt: null,
        closesAt: null,
        error: `O encerramento do periodo de ${label} deve ser apos a abertura.`,
      };
    }
    return { opensAt, closesAt };
  }



  private combineDateTime(date: string, time: string): Date {

    return new Date(`${date}T${time}`);

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

  private async showSuccess(message: string): Promise<void> {

    const alert = await this.alertCtrl.create({ header: 'Sucesso', message, buttons: ['OK'] });

    await alert.present();

  }

  private async showInfo(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Aviso', message, buttons: ['OK'] });
    await alert.present();
  }

}



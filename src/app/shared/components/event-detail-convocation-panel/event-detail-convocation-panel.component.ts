import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { PeladaEvent, TeamSide, teamSideLabel } from '../../../core/models/event.model';
import { AthleteSearchResult } from '../../../core/models/athlete-search.model';
import { AthleteSearchService } from '../../../core/services/athlete-search.service';
import { EventService } from '../../../core/services/event.service';
import { RefereeInvitationService } from '../../../core/services/referee-invitation.service';
import { ScheduleConflict } from '../../../core/models/event-registration.model';
import {
  combineDateAndTimeInputs,
  minDateInputValue,
  resolveInviteResponseDeadline,
  toDateInputValue,
  toTimeInputValue,
} from '../../../core/utils/invite-response-deadline.util';
import { parseErrorMessage } from '../../../core/utils/parse-error.util';
import Parse from 'parse';

export interface TeamMatchConvocationRow {
  userId: string;
  invitationId?: string | null;
  registrationId?: string | null;
  status: string;
  apelido: string;
  avatarUrl?: string;
  offeredAmount: number;
  teamSide: TeamSide;
}

@Component({
  selector: 'app-event-detail-convocation-panel',
  templateUrl: './event-detail-convocation-panel.component.html',
  styleUrls: ['./event-detail-convocation-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventDetailConvocationPanelComponent implements OnChanges {
  @Input({ required: true }) event!: PeladaEvent;
  @Input() manageSides: TeamSide[] = [];
  @Input() canSetMode = false;
  @Input() athleteConvocationBy: 'president' | 'coach' = 'president';

  @Output() back = new EventEmitter<void>();
  @Output() modeChanged = new EventEmitter<'president' | 'coach'>();
  @Output() rosterChanged = new EventEmitter<void>();

  activeSide: TeamSide = 'home';
  loading = false;
  rows: TeamMatchConvocationRow[] = [];
  search = '';
  searchLoading = false;
  candidates: AthleteSearchResult[] = [];
  inviteUserId = '';
  offeredAmount: number | null = null;
  responseDeadlineDate = '';
  responseDeadlineTime = '';
  sending = false;
  removingUserId = '';
  savingMode = false;
  private searchRequestId = 0;

  constructor(
    private readonly eventService: EventService,
    private readonly athleteSearch: AthleteSearchService,
    private readonly invitationService: RefereeInvitationService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['manageSides'] || changes['event']) {
      this.ensureActiveSide();
      void this.reload();
    }
    this.applyDefaultDeadline();
  }

  get teamName(): string {
    return teamSideLabel(this.activeSide, this.event.homeTeamName, this.event.awayTeamName);
  }

  sideLabel(side: TeamSide): string {
    return teamSideLabel(side, this.event.homeTeamName, this.event.awayTeamName);
  }

  get minDeadlineDate(): string {
    return minDateInputValue();
  }

  get offeredAmountDisplay(): string {
    return this.offeredAmount == null ? '' : String(this.offeredAmount);
  }

  onOfferedAmountInput(raw: string | number | null | undefined): void {
    if (raw === '' || raw == null) {
      this.offeredAmount = null;
      return;
    }
    const value = Number(raw);
    this.offeredAmount = Number.isFinite(value) ? value : null;
  }

  onModeChange(value: string): void {
    if (value !== 'president' && value !== 'coach') return;
    void this.saveMode(value);
  }

  onSideChange(side: string): void {
    if (side !== 'home' && side !== 'away') return;
    if (!this.manageSides.includes(side)) return;
    this.activeSide = side;
    void this.reload();
  }

  onSearchInput(event: CustomEvent): void {
    const value = String((event.detail as { value?: string })?.value || '');
    this.search = value;
    void this.runSearch(value);
  }

  selectCandidate(candidate: AthleteSearchResult): void {
    this.inviteUserId = candidate.userId;
    this.search = candidate.apelido || candidate.displayName || '';
    this.candidates = [];
    this.cdr.markForCheck();
  }

  async sendInvite(): Promise<void> {
    if (!this.inviteUserId) {
      await this.showError('Selecione um atleta para convocar.');
      return;
    }
    const deadline = combineDateAndTimeInputs(this.responseDeadlineDate, this.responseDeadlineTime);
    if (!deadline || deadline <= new Date()) {
      await this.showError('Informe um prazo futuro para resposta do convite.');
      return;
    }
    const amount = Number(this.offeredAmount ?? 0);
    if (amount < 0) {
      await this.showError('Valor da convocacao invalido.');
      return;
    }

    const candidate =
      this.candidates.find((row) => row.userId === this.inviteUserId) ||
      ({
        userId: this.inviteUserId,
        displayName: this.search,
        apelido: this.search,
        primaryPosition: '',
      } as AthleteSearchResult);

    const proceed = await this.confirmInviteeScheduleConflict(candidate);
    if (!proceed) return;

    this.sending = true;
    this.cdr.markForCheck();
    const loading = await this.loadingCtrl.create({ message: 'Enviando convocacao...' });
    await loading.present();
    try {
      await Parse.Cloud.run('createTeamMatchAthleteInvitation', {
        eventId: this.event.objectId,
        invitedUserId: this.inviteUserId,
        teamSide: this.activeSide,
        offeredAmount: amount,
        responseDeadline: deadline.toISOString(),
        invitedUserApelido: candidate?.apelido,
        invitedUserFullName: candidate?.fullName || candidate?.displayName,
        invitedUserAvatarUrl: candidate?.avatarUrl,
      });
      this.inviteUserId = '';
      this.offeredAmount = null;
      this.search = '';
      this.candidates = [];
      this.applyDefaultDeadline();
      await this.reload();
      this.rosterChanged.emit();
      const toast = await this.toastCtrl.create({
        message: 'Convocacao enviada.',
        duration: 2200,
        color: 'success',
      });
      await toast.present();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      await loading.dismiss();
      this.sending = false;
      this.cdr.markForCheck();
    }
  }

  private async confirmInviteeScheduleConflict(candidate: AthleteSearchResult): Promise<boolean> {
    if (!this.event?.startTime || !this.event?.endTime) return true;

    const checking = await this.loadingCtrl.create({ message: 'Verificando agenda...' });
    await checking.present();
    let conflict: ScheduleConflict | null = null;
    let sameEventOtherSide = false;
    try {
      // Mesmo confronto, outro time (nao entra no excludeEventId do schedule check).
      const sameEvent = await new Parse.Query('RefereeInvitation')
        .equalTo('event', Parse.Object.extend('Event').createWithoutData(this.event.objectId))
        .equalTo('invitedUser', Parse.User.createWithoutData(this.inviteUserId))
        .equalTo('role', 'athlete')
        .containedIn('status', ['pending', 'accepted'])
        .notEqualTo('teamSide', this.activeSide)
        .first();
      if (sameEvent) {
        sameEventOtherSide = true;
        conflict = {
          eventId: this.event.objectId,
          eventName: this.event.name || 'Este confronto',
          startTime: this.event.startTime,
          endTime: this.event.endTime,
          source: 'pending_invitation',
          invitationId: sameEvent.id,
        };
      } else {
        conflict = await this.invitationService.findInviteeScheduleConflict(
          this.inviteUserId,
          this.event.startTime,
          this.event.endTime,
          this.event.objectId,
          { includePending: true }
        );
      }
    } finally {
      await checking.dismiss();
    }
    if (!conflict) return true;

    const name = candidate.apelido || candidate.displayName || 'O atleta';
    const start = conflict.startTime.toLocaleString('pt-BR');
    const end = conflict.endTime.toLocaleString('pt-BR');
    const message = sameEventOtherSide
      ? `${name} ja foi convocado pelo outro time neste confronto. ` +
        `Deseja enviar a convocacao mesmo assim? O atleta podera escolher qual convite aceitar.`
      : `${name} ja tem convite ou compromisso em "${conflict.eventName}" ` +
        `no mesmo horario (${start} - ${end}). ` +
        `Deseja enviar a convocacao mesmo assim? O atleta podera escolher qual convite aceitar.`;

    return new Promise<boolean>((resolve) => {
      void this.alertCtrl
        .create({
          header: 'Conflito de agenda',
          message,
          buttons: [
            { text: 'Cancelar', role: 'cancel', handler: () => resolve(false) },
            { text: 'Enviar mesmo assim', handler: () => resolve(true) },
          ],
        })
        .then((alert) => alert.present());
    });
  }

  async removeRow(row: TeamMatchConvocationRow): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Remover convocacao',
      message: `Remover ${row.apelido} da convocacao? O atleta sera notificado.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    this.removingUserId = row.userId;
    this.cdr.markForCheck();
    try {
      await Parse.Cloud.run('removeTeamMatchAthleteConvocation', {
        eventId: this.event.objectId,
        athleteUserId: row.userId,
        teamSide: this.activeSide,
      });
      await this.reload();
      this.rosterChanged.emit();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.removingUserId = '';
      this.cdr.markForCheck();
    }
  }

  private async saveMode(value: 'president' | 'coach'): Promise<void> {
    if (!this.canSetMode || this.savingMode) return;
    this.savingMode = true;
    this.cdr.markForCheck();
    try {
      const saved = await this.eventService.setTeamMatchAthleteConvocationBy(
        this.event.objectId,
        value
      );
      this.modeChanged.emit(saved);
      const toast = await this.toastCtrl.create({
        message: 'Quem faz a convocacao atualizado.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.savingMode = false;
      this.cdr.markForCheck();
    }
  }

  private ensureActiveSide(): void {
    if (this.manageSides.includes(this.activeSide)) return;
    this.activeSide = this.manageSides[0] || 'home';
  }

  private applyDefaultDeadline(): void {
    if (!this.event) return;
    const deadline = resolveInviteResponseDeadline(this.event);
    this.responseDeadlineDate = toDateInputValue(deadline);
    this.responseDeadlineTime = toTimeInputValue(deadline);
  }

  private async reload(): Promise<void> {
    if (!this.event || !this.manageSides.length) {
      this.rows = [];
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const result = (await Parse.Cloud.run('listTeamMatchConvocations', {
        eventId: this.event.objectId,
        teamSide: this.activeSide,
      })) as { rows?: TeamMatchConvocationRow[] };
      this.rows = Array.isArray(result.rows) ? result.rows : [];
    } catch (error: unknown) {
      this.rows = [];
      await this.showError(parseErrorMessage(error));
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async runSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      this.candidates = [];
      this.cdr.markForCheck();
      return;
    }
    const requestId = ++this.searchRequestId;
    this.searchLoading = true;
    this.cdr.markForCheck();
    try {
      const results = await this.athleteSearch.search(trimmed);
      if (requestId !== this.searchRequestId) return;
      this.candidates = results.slice(0, 12);
    } catch {
      if (requestId !== this.searchRequestId) return;
      this.candidates = [];
    } finally {
      if (requestId === this.searchRequestId) {
        this.searchLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Convocacao',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}

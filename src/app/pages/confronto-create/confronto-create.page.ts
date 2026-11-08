import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  Address,
  addressCompleteValidator,
  emptyAddress,
  isAddressComplete,
  isAddressEmpty,
} from '../../core/models/address.model';
import { EventInviteCandidate, suggestOfferAmount } from '../../core/models/event-hiring.model';
import { AmateurTeam } from '../../core/models/team.model';
import { AthleteSearchService } from '../../core/services/athlete-search.service';
import { EventService } from '../../core/services/event.service';
import {
  MatchChallengeItem,
  MatchChallengeService,
} from '../../core/services/match-challenge.service';
import { TeamService } from '../../core/services/team.service';
import { I18nService } from '../../core/services/i18n.service';
import {
  clearFormDraft,
  CONFRONTO_FORM_DRAFT_KEY,
  readFormDraft,
  writeFormDraft,
} from '../../core/utils/form-draft.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { AddressFormComponent } from '../../shared/components/address-form/address-form.component';

const CONFRONTO_WIZARD_STEPS = ['details', 'schedule', 'convocation'] as const;
type ConfrontoWizardStep = (typeof CONFRONTO_WIZARD_STEPS)[number];

interface ConfrontoFormDraft {
  stepIndex: number;
  challengeId: string;
  values: Record<string, unknown>;
}

interface TeamPick {
  id: string;
  name: string;
  imageUrl?: string;
}

interface SelectedAthleteInvite extends EventInviteCandidate {
  offeredAmount: number | null;
}

@Component({
  selector: 'app-confronto-create',
  templateUrl: './confronto-create.page.html',
  styleUrls: ['./confronto-create.page.scss'],
  standalone: false,
})
export class ConfrontoCreatePage {
  challengeId = '';
  challengeBlockedMessage = '';
  myTeam: AmateurTeam | null = null;
  homePick: TeamPick | null = null;
  awayPick: TeamPick | null = null;
  athleteQuery = '';
  athleteResults: EventInviteCandidate[] = [];
  athleteSearching = false;
  selectedAthletes: SelectedAthleteInvite[] = [];
  submitting = false;

  readonly wizardSteps = CONFRONTO_WIZARD_STEPS;
  currentStepIndex = 0;

  @ViewChild(AddressFormComponent) private addressForm?: AddressFormComponent;

  form = this.fb.group({
    name: [''],
    challengeConditions: [''],
    startDate: ['', Validators.required],
    startTime: ['', Validators.required],
    endDate: ['', Validators.required],
    endTime: ['', Validators.required],
    address: [emptyAddress(), addressCompleteValidator],
    locationComplement: [''],
    returnLeg: [false],
    returnStartDate: [''],
    returnStartTime: [''],
    returnEndDate: [''],
    returnEndTime: [''],
    returnAddress: [emptyAddress()],
    returnLocationComplement: [''],
  });

  private athleteSearchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly eventService: EventService,
    private readonly teamService: TeamService,
    private readonly challengeService: MatchChallengeService,
    private readonly athleteSearch: AthleteSearchService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get wizardStep(): ConfrontoWizardStep {
    return this.wizardSteps[this.currentStepIndex];
  }

  get wizardProgress(): number {
    return (this.currentStepIndex + 1) / this.wizardSteps.length;
  }

  get wizardProgressLabel(): string {
    return this.i18n.wizardProgress(
      'confrontoForm.wizard.progress',
      this.currentStepIndex + 1,
      this.wizardSteps.length
    );
  }

  get wizardStepHelpKey(): string {
    return `confrontoForm.wizard.step.${this.wizardStep}.help`;
  }

  get wizardStepTitle(): string {
    return this.i18n.t(`confrontoForm.wizard.step.${this.wizardStep}.title`);
  }

  get wizardStepLead(): string {
    return this.i18n.t(`confrontoForm.wizard.step.${this.wizardStep}.lead`);
  }

  async ionViewWillEnter(): Promise<void> {
    this.challengeId = this.route.snapshot.queryParamMap.get('challengeId') || '';
    this.challengeBlockedMessage = '';
    this.myTeam = await this.teamService.getForCurrentUser();
    if (this.myTeam) {
      this.homePick = { id: this.myTeam.objectId, name: this.myTeam.name };
    }

    if (!this.challengeId) {
      this.challengeBlockedMessage =
        'Primeiro envie um desafio e aguarde o aceite. Use Desafiar na aba Confrontos.';
      return;
    }

    try {
      const challenge = await this.challengeService.getAccepted(this.challengeId);
      this.homePick = {
        id: challenge.homeTeamId || challenge.challengerTeamId,
        name: challenge.challengerTeamName,
      };
      this.awayPick = {
        id: challenge.awayTeamId || challenge.challengedTeamId,
        name: challenge.challengedTeamName,
      };
      if (!this.form.get('name')?.value) {
        this.form.patchValue({
          name: `${challenge.challengerTeamName} x ${challenge.challengedTeamName}`,
        });
      }
      if (challenge.challengeConditions && !this.form.get('challengeConditions')?.value) {
        this.form.patchValue({ challengeConditions: challenge.challengeConditions });
      }
      if (challenge.hasReturnLeg) {
        this.form.patchValue({ returnLeg: true });
        this.form.get('returnLeg')?.disable({ emitEvent: false });
      }
      this.prefillScheduleFromChallenge(challenge);
      this.prefillReturnLegFromChallenge(challenge);
      this.restoreDraft();
      this.cdr.markForCheck();
    } catch (error: unknown) {
      this.challengeBlockedMessage = parseErrorMessage(error);
    }
  }

  async exitWizard(): Promise<void> {
    this.persistDraft();
    const alert = await this.alertCtrl.create({
      header: 'Sair do cadastro',
      message: 'Seu rascunho foi salvo neste aparelho. Você pode continuar depois.',
      buttons: [
        { text: 'Continuar preenchendo', role: 'cancel' },
        { text: 'Sair', role: 'destructive', handler: () => this.cancel() },
      ],
    });
    await alert.present();
  }

  goWizardNext(): void {
    if (!this.validateWizardStep()) {
      this.cdr.markForCheck();
      return;
    }
    this.addressForm?.resetIncompleteHint();
    if (this.currentStepIndex < this.wizardSteps.length - 1) {
      this.currentStepIndex += 1;
      this.persistDraft();
      this.cdr.markForCheck();
    }
  }

  goWizardBack(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      this.persistDraft();
      this.cdr.markForCheck();
    }
  }

  wizardSubmit(): void {
    void this.submit();
  }

  validateWizardStep(): boolean {
    const step = this.wizardStep;
    if (step === 'schedule') {
      const values = this.form.getRawValue();
      const startTime = this.combineDateTime(values.startDate || '', values.startTime || '');
      const endTime = this.combineDateTime(values.endDate || '', values.endTime || '');
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        void this.showError('Informe data e hora do jogo de ida.');
        return false;
      }
      if (endTime <= startTime) {
        void this.showError('O termino da ida deve ser apos o inicio.');
        return false;
      }
      if (!isAddressComplete(values.address)) {
        void this.showError('Informe o endereco completo do jogo de ida.');
        return false;
      }
      if (values.returnLeg) {
        const returnStart = this.combineDateTime(
          values.returnStartDate || '',
          values.returnStartTime || ''
        );
        const returnEnd = this.combineDateTime(
          values.returnEndDate || '',
          values.returnEndTime || ''
        );
        if (Number.isNaN(returnStart.getTime()) || Number.isNaN(returnEnd.getTime())) {
          void this.showError('Informe data e hora do jogo da volta.');
          return false;
        }
        if (returnEnd <= returnStart) {
          void this.showError('O termino da volta deve ser apos o inicio.');
          return false;
        }
      }
    }
    return true;
  }

  private restoreDraft(): void {
    const draft = readFormDraft<ConfrontoFormDraft>(CONFRONTO_FORM_DRAFT_KEY);
    if (!draft?.values) return;
    if (draft.challengeId && this.challengeId && draft.challengeId !== this.challengeId) return;
    this.currentStepIndex = Math.min(
      Math.max(0, draft.stepIndex ?? 0),
      this.wizardSteps.length - 1
    );
    const values = draft.values as Record<string, unknown>;
    this.form.patchValue({
      ...values,
      address: (values['address'] as Address) ?? emptyAddress(),
      returnAddress: (values['returnAddress'] as Address) ?? emptyAddress(),
    });
  }

  private persistDraft(): void {
    if (this.challengeBlockedMessage) return;
    writeFormDraft<ConfrontoFormDraft>(CONFRONTO_FORM_DRAFT_KEY, {
      stepIndex: this.currentStepIndex,
      challengeId: this.challengeId,
      values: this.form.getRawValue() as Record<string, unknown>,
    });
  }

  cancel(): void {
    void this.router.navigateByUrl('/tabs/events');
  }

  routerNavigateDesafio(): void {
    void this.router.navigateByUrl('/desafio-create');
  }

  registerMyTeam(): void {
    void this.router.navigate(['/team/form'], {
      queryParams: { returnUrl: '/confronto-create' },
    });
  }

  onAthleteSearch(value: string): void {
    this.athleteQuery = value;
    if (this.athleteSearchTimer) clearTimeout(this.athleteSearchTimer);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.athleteResults = [];
      return;
    }
    this.athleteSearching = true;
    this.athleteSearchTimer = setTimeout(() => {
      void this.searchAthletes(trimmed);
    }, 280);
  }

  addAthlete(candidate: EventInviteCandidate): void {
    if (this.selectedAthletes.some((row) => row.userId === candidate.userId)) return;
    const suggested = suggestOfferAmount('athlete', 'team_match', 'in_person', candidate);
    this.selectedAthletes = [
      ...this.selectedAthletes,
      { ...candidate, offeredAmount: suggested },
    ];
    this.athleteQuery = '';
    this.athleteResults = [];
  }

  viewAthleteProfile(userId: string, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    void this.router.navigate(['/athlete', userId]);
  }

  removeAthlete(userId: string): void {
    this.selectedAthletes = this.selectedAthletes.filter((row) => row.userId !== userId);
  }

  setAthleteOffer(userId: string, value: string | number | null | undefined): void {
    const amount =
      value === '' || value == null || Number.isNaN(Number(value)) ? null : Math.max(0, Number(value));
    this.selectedAthletes = this.selectedAthletes.map((row) =>
      row.userId === userId ? { ...row, offeredAmount: amount } : row
    );
  }

  async submit(): Promise<void> {
    if (this.submitting) return;
    if (!this.challengeId) {
      await this.showError(this.challengeBlockedMessage || 'Desafio aceito obrigatorio.');
      return;
    }
    const homeTeamId = this.homePick?.id || this.myTeam?.objectId || '';
    if (!homeTeamId || !this.awayPick?.id) {
      await this.showError('Times do desafio incompletos.');
      return;
    }

    const values = this.form.getRawValue();
    const startTime = this.combineDateTime(values.startDate || '', values.startTime || '');
    const endTime = this.combineDateTime(values.endDate || '', values.endTime || '');
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      await this.showError('Informe data e hora do jogo de ida.');
      return;
    }
    if (endTime <= startTime) {
      await this.showError('O termino da ida deve ser apos o inicio.');
      return;
    }
    if (!isAddressComplete(values.address)) {
      await this.showError('Informe o endereco completo do jogo de ida.');
      return;
    }

    let returnStartTime: Date | undefined;
    let returnEndTime: Date | undefined;
    if (values.returnLeg) {
      returnStartTime = this.combineDateTime(
        values.returnStartDate || '',
        values.returnStartTime || ''
      );
      returnEndTime = this.combineDateTime(values.returnEndDate || '', values.returnEndTime || '');
      if (Number.isNaN(returnStartTime.getTime()) || Number.isNaN(returnEndTime.getTime())) {
        await this.showError('Informe data e hora do jogo da volta.');
        return;
      }
      if (returnEndTime <= returnStartTime) {
        await this.showError('O termino da volta deve ser apos o inicio.');
        return;
      }
    }

    this.submitting = true;
    const loading = await this.loadingCtrl.create({ message: 'Marcando confronto...' });
    await loading.present();

    try {
      const homeName = this.homePick?.name || this.myTeam?.name || 'Mandante';
      const result = await this.eventService.createTeamMatch({
        name: (values.name || '').trim() || `${homeName} x ${this.awayPick.name}`,
        homeTeamId,
        awayTeamId: this.awayPick.id,
        challengeId: this.challengeId,
        challengeConditions: values.challengeConditions || '',
        startTime,
        endTime,
        address: values.address!,
        locationComplement: values.locationComplement || '',
        returnLeg: !!values.returnLeg,
        returnStartTime,
        returnEndTime,
        returnAddress: isAddressComplete(values.returnAddress) ? values.returnAddress! : undefined,
        returnLocationComplement: values.returnLocationComplement || '',
        athleteInvites: this.selectedAthletes.map((row) => ({
          userId: row.userId,
          offeredAmount: row.offeredAmount ?? 0,
        })),
        athleteUserIds: this.selectedAthletes.map((row) => row.userId),
      });
      await loading.dismiss();
      await this.showCreated(result);
      clearFormDraft(CONFRONTO_FORM_DRAFT_KEY);
      await this.router.navigate(['/event', result.eventId], { replaceUrl: true });
    } catch (error: unknown) {
      await loading.dismiss();
      await this.showError(parseErrorMessage(error));
    } finally {
      this.submitting = false;
    }
  }

  private async searchAthletes(query: string): Promise<void> {
    try {
      const rows = await this.athleteSearch.searchHiringCandidates(query);
      const selected = new Set(this.selectedAthletes.map((row) => row.userId));
      this.athleteResults = rows.filter((row) => !selected.has(row.userId)).slice(0, 12);
    } catch {
      this.athleteResults = [];
    } finally {
      this.athleteSearching = false;
    }
  }

  private combineDateTime(date: string, time: string): Date {
    const normalized = time.length === 5 ? `${time}:00` : time;
    return new Date(`${date}T${normalized}`);
  }

  private prefillScheduleFromChallenge(challenge: {
    proposedStartTime?: Date | null;
    proposedEndTime?: Date | null;
    proposedAddress?: ReturnType<typeof emptyAddress>;
    proposedLocationComplement?: string;
  }): void {
    const start = challenge.proposedStartTime;
    const end = challenge.proposedEndTime;
    if (start && !Number.isNaN(start.getTime()) && !this.form.get('startDate')?.value) {
      this.form.patchValue({
        startDate: this.toDateInput(start),
        startTime: this.toTimeInput(start),
      });
    }
    if (end && !Number.isNaN(end.getTime()) && !this.form.get('endDate')?.value) {
      this.form.patchValue({
        endDate: this.toDateInput(end),
        endTime: this.toTimeInput(end),
      });
    }
    if (challenge.proposedAddress && isAddressComplete(challenge.proposedAddress)) {
      const current = this.form.get('address')?.value;
      if (!isAddressComplete(current)) {
        this.form.patchValue({ address: challenge.proposedAddress });
      }
    }
    if (
      challenge.proposedLocationComplement &&
      !this.form.get('locationComplement')?.value
    ) {
      this.form.patchValue({
        locationComplement: challenge.proposedLocationComplement,
      });
    }
  }

  /** So a volta. A ida continua no prefill de proposedStartTime / endereco proposto. */
  private prefillReturnLegFromChallenge(challenge: MatchChallengeItem): void {
    if (!challenge.hasReturnLeg) return;
    const start = challenge.returnStartTime;
    if (start && !Number.isNaN(start.getTime()) && !this.form.get('returnStartDate')?.value) {
      this.form.patchValue({
        returnStartDate: this.toDateInput(start),
        returnStartTime: this.toTimeInput(start),
      });
    }
    const end = challenge.returnEndTime;
    if (end && !Number.isNaN(end.getTime()) && !this.form.get('returnEndDate')?.value) {
      this.form.patchValue({
        returnEndDate: this.toDateInput(end),
        returnEndTime: this.toTimeInput(end),
      });
    }
    if (challenge.returnLocationComplement && !this.form.get('returnLocationComplement')?.value) {
      this.form.patchValue({ returnLocationComplement: challenge.returnLocationComplement });
    }
    const stored = challenge.returnAddress;
    if (stored && !isAddressEmpty(stored)) {
      const current = this.form.get('returnAddress')?.value;
      if (isAddressEmpty(current)) {
        this.form.patchValue({ returnAddress: stored });
      }
    }
  }

  private toDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toTimeInput(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }

  private async showCreated(result: {
    invitedAthletes: number;
    returnEventId?: string;
    push: { audience?: number; devicesMatched?: number } | null;
  }): Promise<void> {
    const devices = Number(result.push?.devicesMatched || 0);
    const audience = Number(result.push?.audience || 0);
    const legs = result.returnEventId ? 'Ida e volta criados.' : 'Confronto criado.';
    const invited =
      result.invitedAthletes > 0
        ? ` ${result.invitedAthletes} atleta(s) do mandante convocados.`
        : '';
    const push =
      audience > 0
        ? ` Aviso enviado para ${devices} aparelho(s) (${audience} responsavel/atletas, exceto voce).`
        : ' Nenhum outro responsavel recebeu push.';
    const alert = await this.alertCtrl.create({
      header: 'Confronto marcado',
      message: `${legs}${invited}${push}`,
      buttons: ['OK'],
    });
    await alert.present();
    await alert.onDidDismiss();
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Confronto', message, buttons: ['OK'] });
    await alert.present();
  }
}

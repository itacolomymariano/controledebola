import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  addressCompleteValidator,
  emptyAddress,
  isAddressComplete,
} from '../../core/models/address.model';
import { AmateurTeam, TeamPickerRow } from '../../core/models/team.model';
import { I18nService } from '../../core/services/i18n.service';
import { MatchChallengeService } from '../../core/services/match-challenge.service';
import { TeamService } from '../../core/services/team.service';
import {
  clearFormDraft,
  DESAFIO_FORM_DRAFT_KEY,
  readFormDraft,
  writeFormDraft,
} from '../../core/utils/form-draft.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { formatTeamMatchDate, teamMatchResultName } from '../../core/utils/team-match-result.util';
import { AddressFormComponent } from '../../shared/components/address-form/address-form.component';

const DESAFIO_WIZARD_STEPS = ['team', 'opponent', 'schedule', 'extras'] as const;
type DesafioWizardStep = (typeof DESAFIO_WIZARD_STEPS)[number];

interface DesafioFormDraft {
  stepIndex: number;
  challengerTeamId: string;
  selectedTeamId: string;
  selectedTeamName: string;
  message: string;
  challengeConditions: string;
  hasReturnLeg: boolean;
  schedule: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    locationComplement: string;
    address: ReturnType<typeof emptyAddress>;
  };
}

@Component({
  selector: 'app-desafio-create',
  templateUrl: './desafio-create.page.html',
  styleUrls: ['./desafio-create.page.scss'],
  standalone: false,
})
export class DesafioCreatePage {
  myTeams: AmateurTeam[] = [];
  challengerTeamId = '';
  query = '';
  results: TeamPickerRow[] = [];
  searching = false;
  selected: TeamPickerRow | null = null;
  message = '';
  challengeConditions = '';
  hasReturnLeg = false;
  profile: Record<string, unknown> | null = null;
  loadingProfile = false;
  readonly resultName = teamMatchResultName;
  readonly formatMatchDate = formatTeamMatchDate;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly wizardSteps = DESAFIO_WIZARD_STEPS;
  currentStepIndex = 0;

  @ViewChild(AddressFormComponent) private addressForm?: AddressFormComponent;

  scheduleForm = this.fb.group({
    startDate: ['', Validators.required],
    startTime: ['', Validators.required],
    endDate: ['', Validators.required],
    endTime: ['', Validators.required],
    address: [emptyAddress(), addressCompleteValidator],
    locationComplement: [''],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly teamService: TeamService,
    private readonly challengeService: MatchChallengeService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get wizardStep(): DesafioWizardStep {
    return this.wizardSteps[this.currentStepIndex];
  }

  get wizardProgress(): number {
    return (this.currentStepIndex + 1) / this.wizardSteps.length;
  }

  get wizardProgressLabel(): string {
    return this.i18n.t('desafioForm.wizard.progress', {
      current: this.currentStepIndex + 1,
      total: this.wizardSteps.length,
    });
  }

  get wizardStepTitle(): string {
    return this.i18n.t(`desafioForm.wizard.step.${this.wizardStep}.title`);
  }

  get wizardStepLead(): string {
    return this.i18n.t(`desafioForm.wizard.step.${this.wizardStep}.lead`);
  }

  async ionViewWillEnter(): Promise<void> {
    this.myTeams = await this.teamService.listMine();
    this.restoreDraftTeams();
    this.cdr.markForCheck();
  }

  cancel(): void {
    void this.router.navigateByUrl('/tabs/events');
  }

  goRegisterTeam(): void {
    void this.router.navigate(['/team/form'], {
      queryParams: { new: '1', returnUrl: '/desafio-create' },
    });
  }

  onSearch(value: string): void {
    this.query = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.results = [];
      return;
    }
    this.searching = true;
    this.searchTimer = setTimeout(() => void this.runSearch(trimmed), 280);
  }

  async selectTeam(team: TeamPickerRow): Promise<void> {
    if (this.myTeams.some((mine) => mine.objectId === team.id)) {
      await this.showError('Não é possível desafiar um dos seus próprios times.');
      return;
    }
    this.selected = team;
    this.results = [];
    this.query = '';
    this.loadingProfile = true;
    this.profile = null;
    this.persistDraft();
    try {
      this.profile = await this.teamService.getPublicProfile(team.id);
    } catch {
      this.profile = null;
    } finally {
      this.loadingProfile = false;
      this.cdr.markForCheck();
    }
  }

  clearSelected(): void {
    this.selected = null;
    this.profile = null;
    this.persistDraft();
    this.cdr.markForCheck();
  }

  openSelectedTeamProfile(): void {
    if (!this.selected?.id) return;
    void this.router.navigate(['/team', this.selected.id]);
  }

  goWizardNext(): void {
    if (!this.validateWizardStep()) {
      if (this.wizardStep === 'schedule') {
        this.addressForm?.armIncompleteHint();
        this.scheduleForm.markAllAsTouched();
      }
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

  validateWizardStep(): boolean {
    const step = this.wizardStep;
    if (step === 'team') {
      return this.myTeams.length > 0 && !!this.challengerTeamId;
    }
    if (step === 'opponent') {
      return !!this.selected;
    }
    if (step === 'schedule') {
      const values = this.scheduleForm.getRawValue();
      const start = this.combineDateTime(values.startDate || '', values.startTime || '');
      const end = this.combineDateTime(values.endDate || '', values.endTime || '');
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      if (end <= start) return false;
      return isAddressComplete(values.address);
    }
    return true;
  }

  wizardSubmit(): void {
    void this.submit();
  }

  async submit(): Promise<void> {
    if (!this.myTeams.length) {
      await this.showError('Cadastre seu time antes de desafiar.');
      return;
    }
    if (!this.challengerTeamId) {
      await this.showError('Selecione o seu time desafiante.');
      return;
    }
    if (!this.selected) {
      await this.showError('Selecione o time desafiado.');
      return;
    }
    const values = this.scheduleForm.getRawValue();
    const startTime = this.combineDateTime(values.startDate || '', values.startTime || '');
    const endTime = this.combineDateTime(values.endDate || '', values.endTime || '');
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      await this.showError('Informe data e hora desejadas para o confronto.');
      return;
    }
    if (endTime <= startTime) {
      await this.showError('O término deve ser após o início.');
      return;
    }
    if (!isAddressComplete(values.address)) {
      await this.showError('Informe o local desejado do confronto.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Enviando desafio...' });
    await loading.present();
    try {
      await this.challengeService.create({
        challengedTeamId: this.selected.id,
        challengerTeamId: this.challengerTeamId,
        message: this.message.trim(),
        challengeConditions: this.challengeConditions.trim(),
        hasReturnLeg: this.hasReturnLeg,
        proposedStartTime: startTime,
        proposedEndTime: endTime,
        proposedAddress: values.address!,
        proposedLocationComplement: values.locationComplement || '',
      });
      clearFormDraft(DESAFIO_FORM_DRAFT_KEY);
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: 'Desafio enviado',
        message:
          'O presidente adversário recebeu data, hora e local propostos. A agenda dos times foi reservada até a resposta.',
        buttons: ['OK'],
      });
      await alert.present();
      await alert.onDidDismiss();
      await this.router.navigate(['/inbox'], { replaceUrl: true, queryParams: { box: 'out' } });
    } catch (error: unknown) {
      await loading.dismiss();
      await this.showError(parseErrorMessage(error));
    }
  }

  private combineDateTime(date: string, time: string): Date {
    return new Date(`${date}T${time}:00`);
  }

  private async runSearch(query: string): Promise<void> {
    try {
      const mineIds = new Set(this.myTeams.map((team) => team.objectId));
      this.results = (await this.teamService.listForPicker(query)).filter(
        (team) => !mineIds.has(team.id)
      );
    } catch {
      this.results = [];
    } finally {
      this.searching = false;
      this.cdr.markForCheck();
    }
  }

  private restoreDraftTeams(): void {
    const draft = readFormDraft<DesafioFormDraft>(DESAFIO_FORM_DRAFT_KEY);
    if (!draft) {
      if (!this.challengerTeamId && this.myTeams.length) {
        this.challengerTeamId = this.myTeams[0].objectId;
      }
      return;
    }
    this.currentStepIndex = Math.min(
      Math.max(0, draft.stepIndex ?? 0),
      this.wizardSteps.length - 1
    );
    this.challengerTeamId = draft.challengerTeamId || this.myTeams[0]?.objectId || '';
    this.message = draft.message ?? '';
    this.challengeConditions = draft.challengeConditions ?? '';
    this.hasReturnLeg = !!draft.hasReturnLeg;
    if (draft.schedule) {
      this.scheduleForm.patchValue(draft.schedule);
    }
    if (draft.selectedTeamId) {
      this.selected = { id: draft.selectedTeamId, name: draft.selectedTeamName || 'Time' };
      void this.teamService.getPublicProfile(draft.selectedTeamId).then((p) => {
        this.profile = p;
        this.cdr.markForCheck();
      });
    } else if (!this.challengerTeamId && this.myTeams.length) {
      this.challengerTeamId = this.myTeams[0].objectId;
    }
  }

  private persistDraft(): void {
    const schedule = this.scheduleForm.getRawValue();
    writeFormDraft<DesafioFormDraft>(DESAFIO_FORM_DRAFT_KEY, {
      stepIndex: this.currentStepIndex,
      challengerTeamId: this.challengerTeamId,
      selectedTeamId: this.selected?.id ?? '',
      selectedTeamName: this.selected?.name ?? '',
      message: this.message,
      challengeConditions: this.challengeConditions,
      hasReturnLeg: this.hasReturnLeg,
      schedule: {
        startDate: schedule.startDate ?? '',
        startTime: schedule.startTime ?? '',
        endDate: schedule.endDate ?? '',
        endTime: schedule.endTime ?? '',
        locationComplement: schedule.locationComplement ?? '',
        address: schedule.address ?? emptyAddress(),
      },
    });
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Desafio', message, buttons: ['OK'] });
    await alert.present();
  }
}

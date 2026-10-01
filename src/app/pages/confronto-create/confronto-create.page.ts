import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  addressCompleteValidator,
  emptyAddress,
  isAddressComplete,
} from '../../core/models/address.model';
import { EventInviteCandidate, suggestOfferAmount } from '../../core/models/event-hiring.model';
import { AmateurTeam } from '../../core/models/team.model';
import { AthleteSearchService } from '../../core/services/athlete-search.service';
import { EventService } from '../../core/services/event.service';
import { MatchChallengeService } from '../../core/services/match-challenge.service';
import { TeamService } from '../../core/services/team.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

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
    private readonly alertCtrl: AlertController
  ) {}

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
    } catch (error: unknown) {
      this.challengeBlockedMessage = parseErrorMessage(error);
    }
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

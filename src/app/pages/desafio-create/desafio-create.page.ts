import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  addressCompleteValidator,
  emptyAddress,
  isAddressComplete,
} from '../../core/models/address.model';
import { AmateurTeam, TeamPickerRow } from '../../core/models/team.model';
import { MatchChallengeService } from '../../core/services/match-challenge.service';
import { TeamService } from '../../core/services/team.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { formatTeamMatchDate, teamMatchResultName } from '../../core/utils/team-match-result.util';

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
    private readonly alertCtrl: AlertController
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.myTeams = await this.teamService.listMine();
    if (!this.challengerTeamId && this.myTeams.length) {
      this.challengerTeamId = this.myTeams[0].objectId;
    }
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
      await this.showError('Nao e possivel desafiar um dos seus proprios times.');
      return;
    }
    this.selected = team;
    this.results = [];
    this.query = '';
    this.loadingProfile = true;
    this.profile = null;
    try {
      this.profile = await this.teamService.getPublicProfile(team.id);
    } catch {
      this.profile = null;
    } finally {
      this.loadingProfile = false;
    }
  }

  clearSelected(): void {
    this.selected = null;
    this.profile = null;
  }

  openSelectedTeamProfile(): void {
    if (!this.selected?.id) return;
    void this.router.navigate(['/team', this.selected.id]);
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
      await this.showError('O termino deve ser apos o inicio.');
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
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: 'Desafio enviado',
        message:
          'O presidente adversario recebeu data, hora e local propostos. A agenda dos times foi reservada ate a resposta.',
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
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Desafio', message, buttons: ['OK'] });
    await alert.present();
  }
}

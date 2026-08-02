import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormArray, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { PeladaEvent } from '../../core/models/event.model';
import { EventAthleteOption } from '../../core/models/fan-prediction.model';
import { CoachEventBoard } from '../../core/models/support-role-tools.model';
import { EventService } from '../../core/services/event.service';
import { FanPredictionService } from '../../core/services/fan-prediction.service';
import { SupportRoleToolsService } from '../../core/services/support-role-tools.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-event-coach-board',
  templateUrl: './event-coach-board.page.html',
  styleUrls: ['./event-coach-board.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventCoachBoardPage {
  event: PeladaEvent | null = null;
  board: CoachEventBoard | null = null;
  athletes: EventAthleteOption[] = [];
  loading = true;
  saving = false;
  readOnly = false;

  form = this.fb.group({
    talkedToTeam: [false],
    ledWarmup: [false],
    lineupDefined: [false],
    rotationNotes: [''],
    teamNotes: this.fb.array([this.createTeamNoteGroup(0), this.createTeamNoteGroup(1)]),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly eventService: EventService,
    private readonly fanPredictionService: FanPredictionService,
    private readonly supportTools: SupportRoleToolsService,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get teamNotes(): FormArray {
    return this.form.get('teamNotes') as FormArray;
  }

  goBack(): void {
    if (!this.event) {
      void this.router.navigateByUrl('/tabs/peladas');
      return;
    }
    void this.router.navigate(['/event', this.event.objectId]);
  }

  async ionViewWillEnter(): Promise<void> {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) {
      await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const event = await this.eventService.getById(eventId);
      if (!event) {
        await this.showError('Evento nao encontrado.');
        await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
        return;
      }
      this.event = event;
      this.athletes = await this.fanPredictionService.listAthletesForEvent(eventId);
      this.board = await this.supportTools.getCoachEventBoard(eventId);
      if (this.board) {
        this.form.patchValue({
          talkedToTeam: this.board.checklist.talkedToTeam,
          ledWarmup: this.board.checklist.ledWarmup,
          lineupDefined: this.board.checklist.lineupDefined,
          rotationNotes: this.board.rotationNotes,
        });
        this.board.teamNotes.forEach((note, index) => {
          if (this.teamNotes.at(index)) {
            const starterIds =
              this.board?.suggestedStarters.find((line) => line.teamIndex === index)?.userIds ||
              [];
            const starterLabels = starterIds
              .map((userId) => {
                const athlete = this.athletes.find((item) => item.userId === userId);
                return athlete?.apelido || userId;
              })
              .join(', ');
            this.teamNotes.at(index).patchValue({ ...note, starters: starterLabels });
          }
        });
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Erro ao carregar painel do treinador.');
      this.readOnly = true;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async submit(): Promise<void> {
    if (!this.event || this.saving || this.readOnly) return;
    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Salvando...' });
    await loading.present();
    this.cdr.markForCheck();
    try {
      const value = this.form.getRawValue();
      this.board = await this.supportTools.saveCoachEventBoard({
        eventId: this.event.objectId,
        checklist: {
          talkedToTeam: !!value.talkedToTeam,
          ledWarmup: !!value.ledWarmup,
          lineupDefined: !!value.lineupDefined,
        },
        teamNotes: (value.teamNotes || []).map((note, index) => ({
          teamIndex: index,
          teamName: String(note?.teamName || `Time ${index + 1}`),
          formation: String(note?.formation || ''),
          focus: String(note?.focus || ''),
        })),
        suggestedStarters: (value.teamNotes || []).map((note, index) => ({
          teamIndex: index,
          userIds: this.parseStarterIds(String(note?.starters || '')),
        })),
        rotationNotes: String(value.rotationNotes || ''),
      });
      await this.showSuccess('Painel do treinador salvo.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Nao foi possivel salvar o painel.');
    } finally {
      await loading.dismiss();
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private createTeamNoteGroup(teamIndex: number) {
    return this.fb.group({
      teamIndex: [teamIndex],
      teamName: [`Time ${teamIndex + 1}`, Validators.maxLength(40)],
      formation: ['', Validators.maxLength(40)],
      focus: ['', Validators.maxLength(120)],
      starters: [''],
    });
  }

  private parseStarterIds(raw: string): string[] {
    const tokens = raw
      .split(/[,;\n]/)
      .map((token) => token.trim())
      .filter(Boolean);
    const byName = new Map(
      this.athletes.map((athlete) => [athlete.apelido.toLowerCase(), athlete.userId])
    );
    const byId = new Set(this.athletes.map((athlete) => athlete.userId));
    const ids: string[] = [];
    for (const token of tokens) {
      if (byId.has(token)) {
        ids.push(token);
        continue;
      }
      const matched = byName.get(token.toLowerCase());
      if (matched) ids.push(matched);
    }
    return Array.from(new Set(ids)).slice(0, 11);
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Atenção',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async showSuccess(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Pronto',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}

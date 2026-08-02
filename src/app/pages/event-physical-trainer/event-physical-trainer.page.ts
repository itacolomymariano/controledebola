import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { PeladaEvent } from '../../core/models/event.model';
import { EventAthleteOption } from '../../core/models/fan-prediction.model';
import {
  PhysicalTrainerSession,
  TRAINER_FOCUS_LABELS,
  TrainerPlanFocus,
} from '../../core/models/support-role-tools.model';
import { EventService } from '../../core/services/event.service';
import { FanPredictionService } from '../../core/services/fan-prediction.service';
import { SupportRoleToolsService } from '../../core/services/support-role-tools.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-event-physical-trainer',
  templateUrl: './event-physical-trainer.page.html',
  styleUrls: ['./event-physical-trainer.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventPhysicalTrainerPage {
  event: PeladaEvent | null = null;
  session: PhysicalTrainerSession | null = null;
  athletes: EventAthleteOption[] = [];
  loading = true;
  saving = false;
  focusLabels = TRAINER_FOCUS_LABELS;

  form = this.fb.group({
    planFocus: ['general' as TrainerPlanFocus, Validators.required],
    planDurationMin: [15, [Validators.required, Validators.min(1), Validators.max(180)]],
    planNotes: [''],
    athleteUserIds: [[] as string[]],
    cooldownDone: [false],
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

  goBack(): void {
    if (!this.event) {
      void this.router.navigateByUrl('/tabs/peladas');
      return;
    }
    void this.router.navigate(['/event', this.event.objectId]);
  }

  get warmupLabel(): string {
    if (!this.session?.warmupStartedAt) return 'Aquecimento nao iniciado';
    if (this.session.warmupEndedAt) return 'Aquecimento concluido';
    return 'Aquecimento em andamento';
  }

  /** Preparacao so pode ser editada antes do inicio do evento. */
  get canEditPreparation(): boolean {
    return !!this.event && this.event.startTime.getTime() > Date.now();
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
      this.session = await this.supportTools.getPhysicalTrainerSession(eventId);
      if (this.session) {
        this.form.patchValue({
          planFocus: this.session.planFocus,
          planDurationMin: this.session.planDurationMin || 15,
          planNotes: this.session.planNotes,
          athleteUserIds: this.session.athleteUserIds,
          cooldownDone: this.session.cooldownDone,
        });
      }
      if (!this.canEditPreparation) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Erro ao carregar sessao do preparador.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async save(extra?: {
    warmupStarted?: boolean;
    warmupEnded?: boolean;
    clearWarmup?: boolean;
  }): Promise<void> {
    if (!this.event || this.form.invalid || this.saving) return;
    if (!this.canEditPreparation) {
      await this.showError(
        'A preparacao fisica so pode ser registrada antes do inicio do evento.'
      );
      return;
    }
    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Salvando...' });
    await loading.present();
    this.cdr.markForCheck();
    try {
      const value = this.form.getRawValue();
      this.session = await this.supportTools.savePhysicalTrainerSession({
        eventId: this.event.objectId,
        planFocus: value.planFocus as TrainerPlanFocus,
        planDurationMin: Number(value.planDurationMin || 0),
        planNotes: String(value.planNotes || ''),
        athleteUserIds: Array.isArray(value.athleteUserIds) ? value.athleteUserIds : [],
        cooldownDone: !!value.cooldownDone,
        ...extra,
      });
      await this.showSuccess('Sessao do preparador salva.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Nao foi possivel salvar a sessao.');
    } finally {
      await loading.dismiss();
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  startWarmup(): void {
    void this.save({ warmupStarted: true });
  }

  endWarmup(): void {
    void this.save({ warmupEnded: true });
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

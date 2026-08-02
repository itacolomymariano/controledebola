import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { PeladaEvent } from '../../core/models/event.model';
import { EventAthleteOption } from '../../core/models/fan-prediction.model';
import {
  MASSEUR_PHASE_LABELS,
  MASSEUR_RETURN_LABELS,
  MasseurPhase,
  MasseurReturnStatus,
  MasseurTreatment,
} from '../../core/models/support-role-tools.model';
import { EventService } from '../../core/services/event.service';
import { FanPredictionService } from '../../core/services/fan-prediction.service';
import { SupportRoleToolsService } from '../../core/services/support-role-tools.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-event-masseur-treatments',
  templateUrl: './event-masseur-treatments.page.html',
  styleUrls: ['./event-masseur-treatments.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventMasseurTreatmentsPage {
  event: PeladaEvent | null = null;
  athletes: EventAthleteOption[] = [];
  treatments: MasseurTreatment[] = [];
  loading = true;
  saving = false;
  phaseLabels = MASSEUR_PHASE_LABELS;
  returnLabels = MASSEUR_RETURN_LABELS;

  form = this.fb.group({
    athleteUserId: ['', Validators.required],
    phase: ['pre' as MasseurPhase, Validators.required],
    bodyRegion: ['', Validators.required],
    treatmentType: ['', Validators.required],
    durationMin: [10, [Validators.required, Validators.min(1), Validators.max(180)]],
    returnStatus: ['cleared' as MasseurReturnStatus, Validators.required],
    notes: [''],
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
      this.treatments = await this.supportTools.listMasseurTreatments(eventId);
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Erro ao carregar atendimentos.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async submit(): Promise<void> {
    if (!this.event || this.form.invalid || this.saving) return;
    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Salvando atendimento...' });
    await loading.present();
    this.cdr.markForCheck();
    try {
      const value = this.form.getRawValue();
      await this.supportTools.upsertMasseurTreatment({
        eventId: this.event.objectId,
        athleteUserId: String(value.athleteUserId),
        phase: value.phase as MasseurPhase,
        bodyRegion: String(value.bodyRegion || ''),
        treatmentType: String(value.treatmentType || ''),
        durationMin: Number(value.durationMin || 0),
        returnStatus: value.returnStatus as MasseurReturnStatus,
        notes: String(value.notes || ''),
      });
      this.treatments = await this.supportTools.listMasseurTreatments(this.event.objectId);
      this.form.patchValue({ notes: '', bodyRegion: '', treatmentType: '' });
      await this.showSuccess('Atendimento registrado.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Nao foi possivel salvar o atendimento.');
    } finally {
      await loading.dismiss();
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  phaseLabel(phase: MasseurPhase): string {
    return this.phaseLabels[phase] || phase;
  }

  returnLabel(status: MasseurReturnStatus): string {
    return this.returnLabels[status] || status;
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

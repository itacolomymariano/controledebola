import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { PeladaEvent } from '../../core/models/event.model';
import { FanAttendanceMode, FanEventCheckIn } from '../../core/models/support-role-tools.model';
import { EventService } from '../../core/services/event.service';
import { SupportRoleToolsService } from '../../core/services/support-role-tools.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-event-fan-checkin',
  templateUrl: './event-fan-checkin.page.html',
  styleUrls: ['./event-fan-checkin.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventFanCheckInPage {
  event: PeladaEvent | null = null;
  myCheckIn: FanEventCheckIn | null = null;
  checkIns: FanEventCheckIn[] = [];
  loading = true;
  saving = false;
  canEdit = false;

  form = this.fb.group({
    attendanceMode: ['presential' as FanAttendanceMode, Validators.required],
    message: [''],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly eventService: EventService,
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
      this.myCheckIn = await this.supportTools.getMyFanCheckIn(eventId);
      if (this.myCheckIn) {
        this.form.patchValue({
          attendanceMode: this.myCheckIn.attendanceMode,
          message: this.myCheckIn.message,
        });
      }
      try {
        this.checkIns = await this.supportTools.getEventFanCheckIns(eventId);
        this.canEdit = true;
      } catch {
        this.checkIns = this.myCheckIn ? [this.myCheckIn] : [];
        this.canEdit = !!this.myCheckIn || true;
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Erro ao carregar check-in.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async submit(): Promise<void> {
    if (!this.event || this.form.invalid || this.saving) return;
    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Registrando...' });
    await loading.present();
    this.cdr.markForCheck();
    try {
      const value = this.form.getRawValue();
      this.myCheckIn = await this.supportTools.submitFanCheckIn({
        eventId: this.event.objectId,
        attendanceMode: value.attendanceMode as FanAttendanceMode,
        message: value.message || '',
      });
      this.checkIns = await this.supportTools.getEventFanCheckIns(this.event.objectId);
      await this.showSuccess('Check-in da torcida registrado.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error) || 'Nao foi possivel registrar o check-in.');
    } finally {
      await loading.dismiss();
      this.saving = false;
      this.cdr.markForCheck();
    }
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

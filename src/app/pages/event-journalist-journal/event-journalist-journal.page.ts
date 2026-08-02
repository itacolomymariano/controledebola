import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { EventMediaService } from '../../core/services/event-media.service';

type JournalSection = 'reportage' | 'interview';

@Component({
  selector: 'app-event-journalist-journal',
  templateUrl: './event-journalist-journal.page.html',
  styleUrls: ['./event-journalist-journal.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventJournalistJournalPage {
  eventId = '';
  loading = true;
  activeSection: JournalSection = 'reportage';

  reportageHeadline = '';
  reportageBody = '';
  reportagePhotoFile: File | null = null;
  reportagePhotoPreviewUrl = '';
  reportageExistingPhotoUrl = '';

  interviewHeadline = '';
  interviewBody = '';
  interviewPhotoFile: File | null = null;
  interviewPhotoPreviewUrl = '';
  interviewExistingPhotoUrl = '';

  publishingReportage = false;
  publishingInterview = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly eventMediaService: EventMediaService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.loadExistingPublications();
  }

  private async loadExistingPublications(): Promise<void> {
    if (!this.eventId) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const dashboard = await this.eventMediaService.loadDashboard(this.eventId);
      if (dashboard.journalReportage) {
        this.reportageHeadline = dashboard.journalReportage.headline || '';
        this.reportageBody = dashboard.journalReportage.body || '';
        this.reportageExistingPhotoUrl = dashboard.journalReportage.photoUrl || '';
        this.reportagePhotoPreviewUrl = this.reportageExistingPhotoUrl;
      }
      if (dashboard.journalInterview) {
        this.interviewHeadline = dashboard.journalInterview.headline || '';
        this.interviewBody = dashboard.journalInterview.body || '';
        this.interviewExistingPhotoUrl = dashboard.journalInterview.photoUrl || '';
        this.interviewPhotoPreviewUrl = this.interviewExistingPhotoUrl;
      }
    } catch {
      // Formulario segue editavel mesmo se o dashboard falhar.
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onSectionChange(value: JournalSection): void {
    this.activeSection = value;
    this.cdr.markForCheck();
  }

  onReportagePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.reportagePhotoFile = file;
    if (this.reportagePhotoPreviewUrl) URL.revokeObjectURL(this.reportagePhotoPreviewUrl);
    this.reportagePhotoPreviewUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  onInterviewPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.interviewPhotoFile = file;
    if (this.interviewPhotoPreviewUrl) URL.revokeObjectURL(this.interviewPhotoPreviewUrl);
    this.interviewPhotoPreviewUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  async publishReportage(): Promise<void> {
    const headline = this.reportageHeadline.trim();
    const body = this.reportageBody.trim();
    if (headline.length < 2) {
      await this.showError('Informe a manchete da reportagem.');
      return;
    }
    if (!this.reportagePhotoFile && !this.reportageExistingPhotoUrl) {
      await this.showError('Selecione a foto da reportagem.');
      return;
    }
    if (body.length < 10) {
      await this.showError('Informe o texto da reportagem.');
      return;
    }
    const confirmed = await this.confirmOverwrite('uma reportagem');
    if (!confirmed) return;

    this.publishingReportage = true;
    const loading = await this.loadingCtrl.create({ message: 'Enviando reportagem...' });
    await loading.present();
    try {
      const photoUrl = this.reportagePhotoFile
        ? await this.eventMediaService.uploadImageFile(
            this.reportagePhotoFile,
            `event-${this.eventId}-reportage`
          )
        : this.reportageExistingPhotoUrl;
      await this.eventMediaService.publishJournalReportage(this.eventId, headline, photoUrl, body);
      this.reportageExistingPhotoUrl = photoUrl;
      await this.showSuccess('Reportagem enviada ao mural do evento.');
    } catch (error: unknown) {
      await this.showError(this.eventMediaService.errorMessage(error, 'Nao foi possivel enviar a reportagem.'));
    } finally {
      this.publishingReportage = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  async publishInterview(): Promise<void> {
    const headline = this.interviewHeadline.trim();
    const body = this.interviewBody.trim();
    if (headline.length < 2) {
      await this.showError('Informe a manchete da entrevista.');
      return;
    }
    if (!this.interviewPhotoFile && !this.interviewExistingPhotoUrl) {
      await this.showError('Selecione a foto da entrevista.');
      return;
    }
    if (body.length < 10) {
      await this.showError('Informe o texto da entrevista.');
      return;
    }
    const confirmed = await this.confirmOverwrite('uma entrevista de jornal');
    if (!confirmed) return;

    this.publishingInterview = true;
    const loading = await this.loadingCtrl.create({ message: 'Enviando entrevista...' });
    await loading.present();
    try {
      const photoUrl = this.interviewPhotoFile
        ? await this.eventMediaService.uploadImageFile(
            this.interviewPhotoFile,
            `event-${this.eventId}-journal-interview`
          )
        : this.interviewExistingPhotoUrl;
      await this.eventMediaService.publishJournalInterview(this.eventId, headline, photoUrl, body);
      this.interviewExistingPhotoUrl = photoUrl;
      await this.showSuccess('Entrevista enviada ao mural do evento.');
    } catch (error: unknown) {
      await this.showError(this.eventMediaService.errorMessage(error, 'Nao foi possivel enviar a entrevista.'));
    } finally {
      this.publishingInterview = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  private async confirmOverwrite(kind: string): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar envio',
      message: this.eventMediaService.formatPublishOverwriteMessage(kind),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Enviar', role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm';
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Atencao', message, buttons: ['OK'] });
    await alert.present();
  }

  private async showSuccess(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Sucesso', message, buttons: ['OK'] });
    await alert.present();
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { EventMediaService } from '../../core/services/event-media.service';
import { AudioRecordingSession, startAudioRecording } from '../../core/utils/audio-recorder.util';

const NARRATION_MAX_MS = 40_000;
const INTERVIEW_MAX_MS = 50_000;

@Component({
  selector: 'app-event-narrator-radio',
  templateUrl: './event-narrator-radio.page.html',
  styleUrls: ['./event-narrator-radio.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventNarratorRadioPage {
  eventId = '';
  loading = true;

  narrationTitle = '';
  narrationDescription = '';
  interviewTitle = '';
  interviewDescription = '';

  narrationRecording = false;
  interviewRecording = false;
  narrationRemainingMs = NARRATION_MAX_MS;
  interviewRemainingMs = INTERVIEW_MAX_MS;

  narrationAudioBlob: Blob | null = null;
  narrationAudioMimeType = '';
  narrationAudioPreviewUrl = '';
  narrationUploadedUrl = '';

  interviewAudioBlob: Blob | null = null;
  interviewAudioMimeType = '';
  interviewAudioPreviewUrl = '';

  publishingNarration = false;
  publishingInterview = false;

  private narrationSession: AudioRecordingSession | null = null;
  private interviewSession: AudioRecordingSession | null = null;

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
      if (dashboard.radioNarration) {
        this.narrationTitle = dashboard.radioNarration.title || '';
        this.narrationDescription = dashboard.radioNarration.description || '';
        this.narrationUploadedUrl = dashboard.radioNarration.audioUrl || '';
        this.narrationAudioPreviewUrl = this.narrationUploadedUrl;
      }
      if (dashboard.radioInterview) {
        this.interviewTitle = dashboard.radioInterview.title || '';
        this.interviewDescription = dashboard.radioInterview.description || '';
        this.interviewAudioPreviewUrl = dashboard.radioInterview.audioUrl || '';
      }
    } catch {
      // Formulario segue editavel mesmo se o dashboard falhar.
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  async startNarrationRecording(): Promise<void> {
    if (this.narrationRecording || this.interviewRecording) return;
    try {
      this.clearNarrationAudio();
      this.narrationRemainingMs = NARRATION_MAX_MS;
      this.narrationSession = await startAudioRecording(NARRATION_MAX_MS, (remaining) => {
        this.narrationRemainingMs = remaining;
        if (remaining <= 0 && this.narrationRecording) {
          void this.stopNarrationRecording();
        }
        this.cdr.markForCheck();
      });
      this.narrationRecording = true;
      this.cdr.markForCheck();
    } catch (error: unknown) {
      await this.showError(this.eventMediaService.errorMessage(error, 'Nao foi possivel iniciar a gravacao.'));
    }
  }

  async stopNarrationRecording(): Promise<void> {
    if (!this.narrationSession) return;
    const session = this.narrationSession;
    this.narrationSession = null;
    this.narrationRecording = false;
    const result = await session.stop();
    if (result) {
      this.narrationAudioBlob = result.blob;
      this.narrationAudioMimeType = result.mimeType;
      this.narrationAudioPreviewUrl = URL.createObjectURL(result.blob);
    }
    this.cdr.markForCheck();
  }

  async startInterviewRecording(): Promise<void> {
    if (this.interviewRecording || this.narrationRecording) return;
    try {
      this.clearInterviewAudio();
      this.interviewRemainingMs = INTERVIEW_MAX_MS;
      this.interviewSession = await startAudioRecording(INTERVIEW_MAX_MS, (remaining) => {
        this.interviewRemainingMs = remaining;
        if (remaining <= 0 && this.interviewRecording) {
          void this.stopInterviewRecording();
        }
        this.cdr.markForCheck();
      });
      this.interviewRecording = true;
      this.cdr.markForCheck();
    } catch (error: unknown) {
      await this.showError(this.eventMediaService.errorMessage(error, 'Nao foi possivel iniciar a gravacao.'));
    }
  }

  async stopInterviewRecording(): Promise<void> {
    if (!this.interviewSession) return;
    const session = this.interviewSession;
    this.interviewSession = null;
    this.interviewRecording = false;
    const result = await session.stop();
    if (result) {
      this.interviewAudioBlob = result.blob;
      this.interviewAudioMimeType = result.mimeType;
      this.interviewAudioPreviewUrl = URL.createObjectURL(result.blob);
    }
    this.cdr.markForCheck();
  }

  async onNarrationFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.clearNarrationAudio();
    this.narrationAudioBlob = file;
    this.narrationAudioMimeType = file.type || 'audio/mpeg';
    this.narrationAudioPreviewUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  async publishNarration(): Promise<void> {
    const title = this.narrationTitle.trim();
    const description = this.narrationDescription.trim();
    if (title.length < 2) {
      await this.showError('Informe o titulo da narracao.');
      return;
    }
    if (description.length < 2) {
      await this.showError('Informe uma breve descricao da narracao.');
      return;
    }
    if (!this.narrationAudioBlob && !this.narrationUploadedUrl) {
      await this.showError('Grave ou envie o audio da narracao.');
      return;
    }

    const confirmed = await this.confirmOverwrite('uma narracao de gol');
    if (!confirmed) return;

    this.publishingNarration = true;
    const loading = await this.loadingCtrl.create({ message: 'Enviando narracao...' });
    await loading.present();
    try {
      const audioUrl =
        this.narrationUploadedUrl ||
        (await this.eventMediaService.uploadAudioBlob(
          this.narrationAudioBlob!,
          this.narrationAudioMimeType,
          `event-${this.eventId}-narration`
        ));
      await this.eventMediaService.publishRadioNarration(this.eventId, title, description, audioUrl);
      await this.showSuccess('Narracao enviada ao mural do evento.');
      this.narrationUploadedUrl = audioUrl;
    } catch (error: unknown) {
      await this.showError(this.eventMediaService.errorMessage(error, 'Nao foi possivel enviar a narracao.'));
    } finally {
      this.publishingNarration = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  async publishInterview(): Promise<void> {
    const title = this.interviewTitle.trim();
    const description = this.interviewDescription.trim();
    if (title.length < 2) {
      await this.showError('Informe o titulo da entrevista.');
      return;
    }
    if (description.length < 2) {
      await this.showError('Informe uma breve descricao da entrevista.');
      return;
    }
    if (!this.interviewAudioBlob) {
      await this.showError('Grave o audio da entrevista.');
      return;
    }

    const confirmed = await this.confirmOverwrite('uma entrevista de radio');
    if (!confirmed) return;

    this.publishingInterview = true;
    const loading = await this.loadingCtrl.create({ message: 'Enviando entrevista...' });
    await loading.present();
    try {
      const audioUrl = await this.eventMediaService.uploadAudioBlob(
        this.interviewAudioBlob,
        this.interviewAudioMimeType,
        `event-${this.eventId}-interview`
      );
      await this.eventMediaService.publishRadioInterview(this.eventId, title, description, audioUrl);
      await this.showSuccess('Entrevista enviada ao mural do evento.');
    } catch (error: unknown) {
      await this.showError(this.eventMediaService.errorMessage(error, 'Nao foi possivel enviar a entrevista.'));
    } finally {
      this.publishingInterview = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  private clearNarrationAudio(): void {
    if (this.narrationAudioPreviewUrl) {
      URL.revokeObjectURL(this.narrationAudioPreviewUrl);
    }
    this.narrationAudioBlob = null;
    this.narrationAudioMimeType = '';
    this.narrationAudioPreviewUrl = '';
    this.narrationUploadedUrl = '';
  }

  private clearInterviewAudio(): void {
    if (this.interviewAudioPreviewUrl) {
      URL.revokeObjectURL(this.interviewAudioPreviewUrl);
    }
    this.interviewAudioBlob = null;
    this.interviewAudioMimeType = '';
    this.interviewAudioPreviewUrl = '';
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

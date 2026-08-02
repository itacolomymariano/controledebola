import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { EventMediaHighlightVideoItem } from '../../core/models/event-media.model';
import { EventMediaService } from '../../core/services/event-media.service';

@Component({
  selector: 'app-event-cameraman-coverage',
  templateUrl: './event-cameraman-coverage.page.html',
  styleUrls: ['./event-cameraman-coverage.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventCameramanCoveragePage {
  eventId = '';
  loading = true;
  publishing = false;

  title = '';
  description = '';
  videoFile: File | null = null;
  videoPreviewUrl = '';
  durationSec = 0;
  existing: EventMediaHighlightVideoItem | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly eventMediaService: EventMediaService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.loadExisting();
  }

  async onVideoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    if (!file) return;

    try {
      this.durationSec = await this.eventMediaService.readVideoDurationSec(file);
      if (this.videoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.videoPreviewUrl);
      }
      this.videoFile = file;
      this.videoPreviewUrl = URL.createObjectURL(file);
      this.cdr.markForCheck();
    } catch (error: unknown) {
      this.videoFile = null;
      this.durationSec = 0;
      await this.showError(
        this.eventMediaService.errorMessage(error, 'Nao foi possivel validar o video.')
      );
      this.cdr.markForCheck();
    }
  }

  async publish(): Promise<void> {
    if (this.publishing) return;
    const title = this.title.trim();
    const description = this.description.trim();
    if (!title || !description) {
      await this.showError('Informe titulo e breve descricao antes de enviar ao mural.');
      return;
    }
    if (!this.videoFile && !this.existing?.videoUrl) {
      await this.showError('Selecione um video de ate 5 minutos.');
      return;
    }

    if (this.existing) {
      const confirm = await this.alertCtrl.create({
        header: 'Substituir video?',
        message: this.eventMediaService.formatPublishOverwriteMessage(
          'um video de melhores momentos'
        ),
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Enviar', role: 'confirm' },
        ],
      });
      await confirm.present();
      const { role } = await confirm.onDidDismiss();
      if (role !== 'confirm') return;
    }

    this.publishing = true;
    const loading = await this.loadingCtrl.create({ message: 'Enviando video...' });
    await loading.present();
    try {
      let videoUrl = this.existing?.videoUrl || '';
      let durationSec = this.durationSec || this.existing?.durationSec || 0;
      if (this.videoFile) {
        videoUrl = await this.eventMediaService.uploadVideoFile(
          this.videoFile,
          `highlight-${this.eventId}`
        );
        durationSec = this.durationSec;
      }
      await this.eventMediaService.publishHighlightVideo(
        this.eventId,
        title,
        description,
        videoUrl,
        durationSec
      );
      await this.loadExisting();
      const alert = await this.alertCtrl.create({
        header: 'Publicado',
        message: 'Video enviado ao mural do evento.',
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, 'Nao foi possivel publicar o video.')
      );
    } finally {
      this.publishing = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  formatDuration(sec: number): string {
    const total = Math.max(0, Math.round(sec || 0));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private async loadExisting(): Promise<void> {
    if (!this.eventId) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const dashboard = await this.eventMediaService.loadDashboard(this.eventId);
      this.existing = dashboard.highlightVideo;
      if (this.existing) {
        this.title = this.existing.title || '';
        this.description = this.existing.description || '';
        if (!this.videoFile) {
          this.videoPreviewUrl = this.existing.videoUrl || '';
          this.durationSec = this.existing.durationSec || 0;
        }
      }
    } catch {
      // Formulario segue editavel mesmo se o dashboard falhar.
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Atencao',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { EventMediaHighlightVideoItem } from '../../core/models/event-media.model';
import { EventMediaService } from '../../core/services/event-media.service';
import { I18nService } from '../../core/services/i18n.service';

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
    private readonly cdr: ChangeDetectorRef,
    private readonly i18n: I18nService
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
        this.eventMediaService.errorMessage(error, this.i18n.t('eventMedia.error.validateVideo'))
      );
      this.cdr.markForCheck();
    }
  }

  async publish(): Promise<void> {
    if (this.publishing) return;
    const title = this.title.trim();
    const description = this.description.trim();
    if (!title || !description) {
      await this.showError(this.i18n.t('eventCameraman.error.titleDescriptionRequired'));
      return;
    }
    if (!this.videoFile && !this.existing?.videoUrl) {
      await this.showError(this.i18n.t('eventMedia.error.selectVideoMax5Min'));
      return;
    }

    if (this.existing) {
      const confirm = await this.alertCtrl.create({
        header: this.i18n.t('eventMedia.replaceVideoHeader'),
        message: this.eventMediaService.formatPublishOverwriteMessage(
          this.i18n.t('eventMedia.overwriteKind.highlightVideo')
        ),
        buttons: [
          { text: this.i18n.t('common.cancel'), role: 'cancel' },
          { text: this.i18n.t('common.send'), role: 'confirm' },
        ],
      });
      await confirm.present();
      const { role } = await confirm.onDidDismiss();
      if (role !== 'confirm') return;
    }

    this.publishing = true;
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('eventMedia.sendingVideo') });
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
        header: this.i18n.t('common.published'),
        message: this.i18n.t('eventCameraman.toast.videoPublished'),
        buttons: [this.i18n.t('common.ok')],
      });
      await alert.present();
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, this.i18n.t('eventMedia.error.publishVideo'))
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
      header: this.i18n.t('common.attention'),
      message,
      buttons: [this.i18n.t('common.ok')],
    });
    await alert.present();
  }
}

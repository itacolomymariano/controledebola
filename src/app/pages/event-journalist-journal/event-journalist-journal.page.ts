import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { LocaleRefreshDirective } from '../../shared/directives/locale-refresh.directive';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { EventMediaService } from '../../core/services/event-media.service';
import { I18nService } from '../../core/services/i18n.service';

type JournalSection = 'reportage' | 'interview';

@Component({
  selector: 'app-event-journalist-journal',
  templateUrl: './event-journalist-journal.page.html',
  styleUrls: ['./event-journalist-journal.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [LocaleRefreshDirective],
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
    private readonly cdr: ChangeDetectorRef,
    private readonly i18n: I18nService
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
      await this.showError(this.i18n.t('eventMedia.validation.reportHeadline'));
      return;
    }
    if (!this.reportagePhotoFile && !this.reportageExistingPhotoUrl) {
      await this.showError(this.i18n.t('eventMedia.validation.reportPhoto'));
      return;
    }
    if (body.length < 10) {
      await this.showError(this.i18n.t('eventMedia.validation.reportBody'));
      return;
    }
    const confirmed = await this.confirmOverwrite(this.i18n.t('eventMedia.overwriteKind.reportage'));
    if (!confirmed) return;

    this.publishingReportage = true;
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('eventMedia.sendingReportage') });
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
      await this.showSuccess(this.i18n.t('eventJournalist.toast.reportagePublished'));
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, this.i18n.t('eventMedia.error.sendReportage'))
      );
    } finally {
      this.publishingReportage = false;
      try {
        await loading.dismiss();
      } catch {
        /* overlay ja fechado */
      }
      this.cdr.markForCheck();
    }
  }

  async publishInterview(): Promise<void> {
    const headline = this.interviewHeadline.trim();
    const body = this.interviewBody.trim();
    if (headline.length < 2) {
      await this.showError(this.i18n.t('eventMedia.validation.journalInterviewHeadline'));
      return;
    }
    if (!this.interviewPhotoFile && !this.interviewExistingPhotoUrl) {
      await this.showError(this.i18n.t('eventMedia.validation.journalInterviewPhoto'));
      return;
    }
    if (body.length < 10) {
      await this.showError(this.i18n.t('eventMedia.validation.journalInterviewBody'));
      return;
    }
    const confirmed = await this.confirmOverwrite(this.i18n.t('eventMedia.overwriteKind.journalInterview'));
    if (!confirmed) return;

    this.publishingInterview = true;
    const loading = await this.loadingCtrl.create({ message: this.i18n.t('eventMedia.sendingJournalInterview') });
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
      await this.showSuccess(this.i18n.t('eventJournalist.toast.interviewPublished'));
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, this.i18n.t('eventMedia.error.sendJournalInterview'))
      );
    } finally {
      this.publishingInterview = false;
      try {
        await loading.dismiss();
      } catch {
        /* overlay ja fechado */
      }
      this.cdr.markForCheck();
    }
  }

  private async confirmOverwrite(kind: string): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('eventMedia.confirmSendHeader'),
      message: this.eventMediaService.formatPublishOverwriteMessage(kind),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        { text: this.i18n.t('common.send'), role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm';
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('common.attention'),
      message,
      buttons: [this.i18n.t('common.ok')],
    });
    await alert.present();
  }

  private async showSuccess(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('eventDetail.alert.success'),
      message,
      buttons: [this.i18n.t('common.ok')],
    });
    await alert.present();
  }
}

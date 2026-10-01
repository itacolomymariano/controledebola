import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import {
  ContactMessageKind,
  ContactMessageService,
} from '../../core/services/contact-message.service';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-contact-message',
  templateUrl: './contact-message.page.html',
  styleUrls: ['./contact-message.page.scss'],
  standalone: false,
})
export class ContactMessagePage {
  kind: ContactMessageKind = 'feedback';
  userName = '';
  userApelido = '';
  attachment: File | null = null;
  attachmentLabel = '';

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    body: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly contact: ContactMessageService,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService
  ) {}

  ionViewWillEnter(): void {
    const raw = String(this.route.snapshot.paramMap.get('kind') || '');
    this.kind = raw === 'support' ? 'support' : 'feedback';
    this.userName = this.auth.getFullName() || this.auth.getDisplayName();
    this.userApelido = this.auth.getApelido() || '—';
    void this.auth.fetchCurrentUser().then((user) => {
      if (!user) return;
      this.userName = this.auth.getFullName() || this.auth.getDisplayName();
      this.userApelido = this.auth.getApelido() || '—';
    });
  }

  get pageTitle(): string {
    return this.kind === 'support'
      ? this.i18n.t('contact.supportTitle')
      : this.i18n.t('contact.feedbackTitle');
  }

  get bodyLabel(): string {
    return this.kind === 'support'
      ? this.i18n.t('contact.problem')
      : this.i18n.t('contact.description');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    this.attachment = file;
    this.attachmentLabel = file ? file.name : '';
  }

  clearAttachment(): void {
    this.attachment = null;
    this.attachmentLabel = '';
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: this.i18n.t('contact.sending') });
    await loading.present();

    try {
      const { title, body } = this.form.getRawValue();
      await this.contact.send({
        kind: this.kind,
        title: title || '',
        body: body || '',
        attachment: this.attachment,
      });
      this.form.reset();
      this.clearAttachment();
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: this.i18n.t('contact.sentTitle'),
        message: this.i18n.t('contact.sentBody'),
        buttons: [this.i18n.t('ok')],
      });
      await alert.present();
    } catch (error: unknown) {
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: this.i18n.t('contact.failedTitle'),
        message: this.i18n.translateError(error) || this.i18n.t('contact.failedBody'),
        buttons: [this.i18n.t('ok')],
      });
      await alert.present();
    }
  }
}

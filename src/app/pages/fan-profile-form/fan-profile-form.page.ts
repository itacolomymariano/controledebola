import { Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { FanProfileService } from '../../core/services/fan-profile.service';

@Component({
  selector: 'app-fan-profile-form',
  templateUrl: './fan-profile-form.page.html',
  styleUrls: ['./fan-profile-form.page.scss'],
  standalone: false,
})
export class FanProfileFormPage {
  hasProfile = false;
  displayName = '';
  apelido = '';
  avatarUrl: string | null = null;

  form = this.fb.group({
    peladaPresentialRate: [null as number | null],
    peladaRemoteRate: [null as number | null],
    matchPresentialRate: [null as number | null],
    matchRemoteRate: [null as number | null],
    acceptsPaidCommitments: [false],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly fanProfileService: FanProfileService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  async ionViewWillEnter(): Promise<void> {
    if (this.auth.isLoggedIn()) {
      await this.auth.fetchCurrentUser();
    }

    this.displayName = this.auth.getDisplayName();
    const user = this.auth.getCurrentUser();
    this.apelido = (user?.get('apelido') as string) || '';
    this.avatarUrl = this.auth.getAvatarUrl();

    const profile = await this.fanProfileService.getForCurrentUser();
    this.hasProfile = !!profile;
    if (profile) {
      this.form.patchValue({
        peladaPresentialRate: profile.peladaPresentialRate ?? null,
        peladaRemoteRate: profile.peladaRemoteRate ?? null,
        matchPresentialRate: profile.matchPresentialRate ?? null,
        matchRemoteRate: profile.matchRemoteRate ?? null,
        acceptsPaidCommitments: !!profile.acceptsPaidCommitments,
      });
    }
  }

  cancel(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }

  async submit(): Promise<void> {
    const v = this.form.getRawValue();
    const loading = await this.loadingCtrl.create({ message: 'Salvando perfil...' });
    await loading.present();

    try {
      const payload = {
        peladaPresentialRate: v.peladaPresentialRate != null ? Number(v.peladaPresentialRate) : undefined,
        peladaRemoteRate: v.peladaRemoteRate != null ? Number(v.peladaRemoteRate) : undefined,
        matchPresentialRate: v.matchPresentialRate != null ? Number(v.matchPresentialRate) : undefined,
        matchRemoteRate: v.matchRemoteRate != null ? Number(v.matchRemoteRate) : undefined,
        acceptsPaidCommitments: !!v.acceptsPaidCommitments,
      };

      if (this.hasProfile) {
        await this.fanProfileService.update(payload);
      } else {
        await this.fanProfileService.create(payload);
        this.hasProfile = true;
      }

      const alert = await this.alertCtrl.create({
        header: 'Perfil salvo',
        message: 'Seu perfil de torcedor foi atualizado.',
        buttons: ['OK'],
      });
      await alert.present();
      void this.router.navigateByUrl('/tabs/profile');
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
    } finally {
      await loading.dismiss();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

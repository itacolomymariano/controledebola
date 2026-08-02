import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { getUniformById } from '../../core/data/team-uniforms.data';
import { AmateurTeam } from '../../core/models/team.model';
import { TeamService } from '../../core/services/team.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';

@Component({
  selector: 'app-team-form',
  templateUrl: './team-form.page.html',
  styleUrls: ['./team-form.page.scss'],
  standalone: false,
})
export class TeamFormPage {
  team: AmateurTeam | null = null;
  teamImageFile: File | null = null;
  presidentImageFile: File | null = null;
  teamImagePreview: string | null = null;
  presidentImagePreview: string | null = null;
  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    uniformId: ['', Validators.required],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly teamService: TeamService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  get selectedUniform() {
    const id = this.form.get('uniformId')?.value as string;
    return id ? getUniformById(id) : undefined;
  }

  async ionViewWillEnter(): Promise<void> {
    this.team = await this.teamService.getForCurrentUser();
    if (!this.team) return;

    this.teamImagePreview = this.team.teamImageUrl;
    this.presidentImagePreview = this.team.presidentImageUrl;
    this.form.patchValue({
      name: this.team.name,
      uniformId: this.team.uniformId,
    });
    this.form.disable();
  }

  cancel(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }

  onTeamImageSelected(file: File): void {
    this.teamImageFile = file;
    this.teamImagePreview = URL.createObjectURL(file);
  }

  onPresidentImageSelected(file: File): void {
    this.presidentImageFile = file;
    this.presidentImagePreview = URL.createObjectURL(file);
  }

  async submit(): Promise<void> {
    if (this.team) {
      this.cancel();
      return;
    }

    if (!this.teamImageFile || !this.presidentImageFile) {
      await this.showError('Selecione a imagem do time e a imagem do presidente.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.form, {
        name: 'Nome do time',
        uniformId: 'Uniforme',
      });
      if (message) await this.showError(message);
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Salvando time...' });
    await loading.present();

    try {
      const values = this.form.getRawValue();
      await this.teamService.create({
        name: values.name!,
        teamImage: this.teamImageFile,
        presidentImage: this.presidentImageFile,
        uniformId: values.uniformId!,
      });
      await this.router.navigateByUrl('/tabs/profile', { replaceUrl: true });
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      await loading.dismiss();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

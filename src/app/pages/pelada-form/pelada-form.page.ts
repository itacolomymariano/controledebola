import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress } from '../../core/models/address.model';
import { PeladaSport } from '../../core/models/pelada.model';
import { PeladaService } from '../../core/services/pelada.service';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';

@Component({
  selector: 'app-pelada-form',
  templateUrl: './pelada-form.page.html',
  styleUrls: ['./pelada-form.page.scss'],
  standalone: false,
})
export class PeladaFormPage {
  isEdit = false;
  peladaId?: string;
  adminPhotoFile: File | null = null;
  locationPhotoFile: File | null = null;
  adminPhotoPreview: string | null = null;
  locationPhotoPreview: string | null = null;

  sports: { value: PeladaSport; label: string }[] = [
    { value: 'campo', label: 'Campo' },
    { value: 'futsal', label: 'Futsal' },
    { value: 'society', label: 'Society' },
    { value: 'beach', label: 'Beach' },
  ];

  form = this.fb.group({
    name: ['', Validators.required],
    sport: ['campo' as PeladaSport, Validators.required],
    memberCount: [0, [Validators.min(0)]],
    monthlyFee: [0, [Validators.min(0)]],
    foundedDate: [''],
    address: [emptyAddress(), Validators.required],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly peladaService: PeladaService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.peladaId = this.route.snapshot.paramMap.get('id') ?? undefined;
    this.isEdit = !!this.peladaId;

    if (this.isEdit && this.peladaId) {
      const pelada = await this.peladaService.getById(this.peladaId);
      if (!pelada) {
        await this.showError('Pelada nao encontrada.');
        void this.router.navigateByUrl('/tabs/peladas');
        return;
      }
      this.adminPhotoPreview = pelada.adminPhotoUrl ?? null;
      this.locationPhotoPreview = pelada.locationPhotoUrl ?? null;
      this.form.patchValue({
        name: pelada.name,
        sport: pelada.sport,
        memberCount: pelada.memberCount,
        monthlyFee: pelada.monthlyFee,
        foundedDate: pelada.foundedAt
          ? pelada.foundedAt.toISOString().slice(0, 10)
          : '',
        address: pelada.address,
      });
    }
  }

  cancel(): void {
    if (this.isEdit && this.peladaId) {
      void this.router.navigate(['/pelada', this.peladaId]);
    } else {
      void this.router.navigateByUrl('/tabs/peladas');
    }
  }

  onAddressChanged(): void {
    this.form.get('address')?.updateValueAndValidity();
  }

  onAdminPhotoSelected(file: File): void {
    this.adminPhotoFile = file;
    this.adminPhotoPreview = URL.createObjectURL(file);
  }

  onLocationPhotoSelected(file: File): void {
    this.locationPhotoFile = file;
    this.locationPhotoPreview = URL.createObjectURL(file);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const message =
        buildMissingFieldsMessage(this.form, {
          name: 'Nome da pelada',
          sport: 'Esporte',
          address: 'Endereco validado (selecione na lista)',
        }) || 'Verifique os campos obrigatorios do cadastro.';
      await this.showError(message);
      return;
    }

    const v = this.form.getRawValue();
    const foundedAt = v.foundedDate ? new Date(v.foundedDate!) : undefined;
    const loading = await this.loadingCtrl.create({
      message: this.isEdit ? 'Salvando...' : 'Criando pelada...',
    });
    await loading.present();

    try {
      if (this.isEdit && this.peladaId) {
        await this.peladaService.update(this.peladaId, {
          name: v.name!,
          sport: v.sport!,
          address: v.address!,
          memberCount: Number(v.memberCount ?? 0),
          monthlyFee: Number(v.monthlyFee ?? 0),
          foundedAt,
          adminPhotoFile: this.adminPhotoFile ?? undefined,
          locationPhotoFile: this.locationPhotoFile ?? undefined,
        });
        await this.router.navigate(['/pelada', this.peladaId]);
      } else {
        const pelada = await this.peladaService.create({
          name: v.name!,
          sport: v.sport!,
          address: v.address!,
          memberCount: Number(v.memberCount ?? 0),
          monthlyFee: Number(v.monthlyFee ?? 0),
          foundedAt,
          adminPhotoFile: this.adminPhotoFile ?? undefined,
          locationPhotoFile: this.locationPhotoFile ?? undefined,
        });
        await this.router.navigate(['/pelada', pelada.objectId]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar.';
      await this.showError(message);
    } finally {
      await loading.dismiss();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

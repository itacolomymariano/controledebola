import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress, isAddressComplete } from '../../core/models/address.model';
import { PeladaSport } from '../../core/models/pelada.model';
import { PeladaService } from '../../core/services/pelada.service';
import { WizardTourService } from '../../core/services/wizard-tour.service';
import { birthDateToIsoString, parseBirthDateIso } from '../../core/utils/birth-date.util';
import {
  clearFormDraft,
  PELADA_FORM_DRAFT_KEY,
  readFormDraft,
  writeFormDraft,
} from '../../core/utils/form-draft.util';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';
import { AddressFormComponent } from '../../shared/components/address-form/address-form.component';
import { I18nService } from '../../core/services/i18n.service';

const PELADA_WIZARD_STEPS = ['basics', 'rules', 'location', 'photos'] as const;
type PeladaWizardStep = (typeof PELADA_WIZARD_STEPS)[number];

interface PeladaFormDraft {
  stepIndex: number;
  name: string;
  sport: PeladaSport;
  memberCount: number;
  monthlyFee: number;
  foundedDate: string;
  address: ReturnType<typeof emptyAddress>;
}

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

  readonly wizardSteps = PELADA_WIZARD_STEPS;
  currentStepIndex = 0;

  @ViewChild(AddressFormComponent) private addressForm?: AddressFormComponent;

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
    private readonly wizardTour: WizardTourService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get wizardStep(): PeladaWizardStep {
    return this.wizardSteps[this.currentStepIndex];
  }

  get wizardProgress(): number {
    return (this.currentStepIndex + 1) / this.wizardSteps.length;
  }

  get wizardProgressLabel(): string {
    return this.i18n.t('peladaForm.wizard.progress', {
      current: this.currentStepIndex + 1,
      total: this.wizardSteps.length,
    });
  }

  get wizardStepTitle(): string {
    return this.i18n.t(`peladaForm.wizard.step.${this.wizardStep}.title`);
  }

  get wizardStepLead(): string {
    return this.i18n.t(`peladaForm.wizard.step.${this.wizardStep}.lead`);
  }

  async ionViewWillEnter(): Promise<void> {
    this.peladaId = this.route.snapshot.paramMap.get('id') ?? undefined;
    this.isEdit = !!this.peladaId;

    if (this.isEdit && this.peladaId) {
      const pelada = await this.peladaService.getById(this.peladaId);
      if (!pelada) {
        await this.showError('Pelada não encontrada.');
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
        foundedDate: pelada.foundedAt ? birthDateToIsoString(pelada.foundedAt) : '',
        address: pelada.address,
      });
    } else {
      this.restoreDraft();
    }
    this.cdr.markForCheck();
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
    this.persistDraft();
  }

  onAdminPhotoSelected(file: File): void {
    this.adminPhotoFile = file;
    this.adminPhotoPreview = URL.createObjectURL(file);
  }

  onLocationPhotoSelected(file: File): void {
    this.locationPhotoFile = file;
    this.locationPhotoPreview = URL.createObjectURL(file);
  }

  goWizardNext(): void {
    if (!this.validateWizardStep()) {
      if (this.wizardStep === 'location') {
        this.addressForm?.armIncompleteHint();
      }
      this.cdr.markForCheck();
      return;
    }
    this.addressForm?.resetIncompleteHint();
    if (this.currentStepIndex < this.wizardSteps.length - 1) {
      this.currentStepIndex += 1;
      this.persistDraft();
      this.cdr.markForCheck();
    }
  }

  goWizardBack(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      this.persistDraft();
      this.cdr.markForCheck();
    }
  }

  validateWizardStep(): boolean {
    const step = this.wizardStep;
    if (step === 'basics') {
      this.form.get('name')?.markAsTouched();
      return this.form.get('name')!.valid && this.form.get('sport')!.valid;
    }
    if (step === 'rules') {
      return true;
    }
    if (step === 'location') {
      const addr = this.form.get('address')?.value;
      return !!addr && isAddressComplete(addr);
    }
    if (step === 'photos') {
      return true;
    }
    return false;
  }

  wizardSubmit(): void {
    void this.submit();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const message =
        buildMissingFieldsMessage(this.form, {
          name: 'Nome da pelada',
          sport: 'Esporte',
          address: 'Endereço validado (selecione na lista)',
        }) || 'Verifique os campos obrigatórios do cadastro.';
      await this.showError(message);
      return;
    }

    const v = this.form.getRawValue();
    const foundedAt = v.foundedDate ? parseBirthDateIso(v.foundedDate) ?? undefined : undefined;
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
        clearFormDraft(PELADA_FORM_DRAFT_KEY);
        this.wizardTour.completeStepById('pelada-admin-create');
        if (this.wizardTour.current?.id === 'pelada-admin-first-event') {
          await this.router.navigate(['/event-create'], {
            queryParams: { peladaId: pelada.objectId },
            replaceUrl: true,
          });
        } else {
          await this.router.navigate(['/pelada', pelada.objectId]);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar.';
      await this.showError(message);
    } finally {
      await loading.dismiss();
    }
  }

  private restoreDraft(): void {
    const draft = readFormDraft<PeladaFormDraft>(PELADA_FORM_DRAFT_KEY);
    if (!draft) return;
    this.currentStepIndex = Math.min(
      Math.max(0, draft.stepIndex ?? 0),
      this.wizardSteps.length - 1
    );
    this.form.patchValue({
      name: draft.name ?? '',
      sport: draft.sport ?? 'campo',
      memberCount: draft.memberCount ?? 0,
      monthlyFee: draft.monthlyFee ?? 0,
      foundedDate: draft.foundedDate ?? '',
      address: draft.address ?? emptyAddress(),
    });
  }

  private persistDraft(): void {
    if (this.isEdit) return;
    const v = this.form.getRawValue();
    writeFormDraft<PeladaFormDraft>(PELADA_FORM_DRAFT_KEY, {
      stepIndex: this.currentStepIndex,
      name: v.name ?? '',
      sport: v.sport ?? 'campo',
      memberCount: Number(v.memberCount ?? 0),
      monthlyFee: Number(v.monthlyFee ?? 0),
      foundedDate: v.foundedDate ?? '',
      address: v.address ?? emptyAddress(),
    });
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

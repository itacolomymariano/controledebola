import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription, merge } from 'rxjs';
import { Address, emptyAddress } from '../../core/models/address.model';
import { MIN_PASSWORD_LENGTH } from '../../core/constants/auth.constants';
import { AuthService } from '../../core/services/auth.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { birthDateToIsoString, parseBirthDateIso } from '../../core/utils/birth-date.util';
import { consumeLegendFormReturnState } from '../../core/utils/legend-form-navigation.util';

interface AccountSnapshot {
  name: string;
  apelido: string;
  email: string;
  phone: string;
  birthDate: string;
  proFootballIdol: string;
  amateurFootballIdol: string;
  favoriteProTeam: string;
  favoriteAmateurTeam: string;
  showPhoneInProfile: boolean;
  showEmailInProfile: boolean;
  address: Address;
}

function emailOrPhoneValidator(control: AbstractControl): ValidationErrors | null {
  const email = control.get('email')?.value?.trim();
  const phone = control.get('phone')?.value?.trim();
  return email || phone ? null : { contactRequired: true };
}

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = String(control.get('newPassword')?.value ?? '');
  const confirmPassword = String(control.get('confirmPassword')?.value ?? '');
  if (!newPassword && !confirmPassword) return null;
  return newPassword === confirmPassword ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-account-edit',
  templateUrl: './account-edit.page.html',
  styleUrls: ['./account-edit.page.scss'],
  standalone: false,
})
export class AccountEditPage implements OnInit, OnDestroy {
  canSubmit = false;
  canChangePassword = false;
  showPasswordSection = false;
  forcePasswordChange = false;
  readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  showPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  private initialSnapshot: AccountSnapshot | null = null;
  private formSub?: Subscription;
  private passwordFormSub?: Subscription;

  form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      apelido: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(30),
          Validators.pattern(/^[a-zA-Z0-9\u00C0-\u017F\s._-]+$/),
        ],
      ],
      email: [''],
      phone: [''],
      birthDate: [''],
      proFootballIdol: [''],
      amateurFootballIdol: [''],
      favoriteProTeam: [''],
      favoriteAmateurTeam: [''],
      showPhoneInProfile: [false],
      showEmailInProfile: [false],
      address: [emptyAddress()],
    },
    { validators: [emailOrPhoneValidator] }
  );

  passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [passwordsMatchValidator] }
  );

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.formSub = merge(this.form.statusChanges, this.form.valueChanges).subscribe(() => {
      this.updateCanSubmit();
    });
    this.passwordFormSub = merge(
      this.passwordForm.statusChanges,
      this.passwordForm.valueChanges
    ).subscribe(() => {
      this.canChangePassword = this.passwordForm.valid;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
    this.passwordFormSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.forcePasswordChange = this.route.snapshot.queryParamMap.get('forcePassword') === '1';
    if (this.forcePasswordChange) {
      this.showPasswordSection = true;
    }
    void this.loadCurrentData().then(() => this.applyLegendFormReturn());
  }

  togglePasswordSection(): void {
    this.showPasswordSection = !this.showPasswordSection;
    if (!this.showPasswordSection) {
      this.passwordForm.reset();
      this.canChangePassword = false;
    }
    this.cdr.markForCheck();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onAddressChanged(): void {
    this.form.get('address')?.updateValueAndValidity();
    this.updateCanSubmit();
  }

  cancel(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) {
      if (this.form.invalid) this.form.markAllAsTouched();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmar alteracoes',
      message: 'Deseja salvar as alteracoes realizadas nos seus dados?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: () => {
            void this.doSubmit();
          },
        },
      ],
    });
    await alert.present();
  }

  async submitPasswordChange(): Promise<void> {
    if (!this.passwordForm.valid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmar nova senha',
      message: 'Deseja alterar sua senha de acesso?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Alterar senha',
          handler: () => {
            void this.doPasswordChange();
          },
        },
      ],
    });
    await alert.present();
  }

  private async doSubmit(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Salvando...' });
    await loading.present();

    try {
      const v = this.form.getRawValue();
      await this.auth.updateUserAccount({
        name: v.name!,
        apelido: v.apelido!,
        email: v.email || undefined,
        phone: v.phone || undefined,
        address: v.address!,
        birthDate: v.birthDate ? parseBirthDateIso(v.birthDate) : null,
        proFootballIdol: v.proFootballIdol ?? '',
        amateurFootballIdol: v.amateurFootballIdol ?? '',
        favoriteProTeam: v.favoriteProTeam ?? '',
        favoriteAmateurTeam: v.favoriteAmateurTeam ?? '',
        showPhoneInProfile: !!v.showPhoneInProfile,
        showEmailInProfile: !!v.showEmailInProfile,
      });

      this.initialSnapshot = this.snapshotFromForm(v);
      this.updateCanSubmit();

      const alert = await this.alertCtrl.create({
        header: 'Dados atualizados',
        message: 'Suas informacoes foram salvas com sucesso.',
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      await loading.dismiss();
    }
  }

  private async doPasswordChange(): Promise<void> {
    const v = this.passwordForm.getRawValue();
    const loading = await this.loadingCtrl.create({ message: 'Alterando senha...' });
    await loading.present();

    try {
      await this.auth.changePassword(v.currentPassword!, v.newPassword!);
      this.passwordForm.reset();
      this.showPasswordSection = false;
      this.canChangePassword = false;

      const alert = await this.alertCtrl.create({
        header: 'Senha alterada',
        message: 'Sua senha foi atualizada com sucesso.',
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  private applyLegendFormReturn(): void {
    const state = consumeLegendFormReturnState('/account/edit');
    if (!state?.selectedValue || !state.returnField) {
      return;
    }

    this.form.patchValue({ [state.returnField]: state.selectedValue });
    this.form.get(state.returnField)?.markAsDirty();
    this.updateCanSubmit();
    this.cdr.markForCheck();
  }

  private async loadCurrentData(): Promise<void> {
    const user = await this.auth.fetchCurrentUser();
    if (!user) {
      void this.router.navigateByUrl('/login');
      return;
    }

    const birthDate = user.get('birthDate') as Date | undefined;
    const values = {
      name: (user.get('name') as string) || '',
      apelido: (user.get('apelido') as string) || '',
      email: (user.get('email') as string) || '',
      phone: (user.get('phone') as string) || '',
      birthDate: birthDate ? birthDateToIsoString(birthDate) : '',
      proFootballIdol: (user.get('proFootballIdol') as string) || '',
      amateurFootballIdol: (user.get('amateurFootballIdol') as string) || '',
      favoriteProTeam: (user.get('favoriteProTeam') as string) || '',
      favoriteAmateurTeam: (user.get('favoriteAmateurTeam') as string) || '',
      showPhoneInProfile: !!user.get('showPhoneInProfile'),
      showEmailInProfile: !!user.get('showEmailInProfile'),
      address: (user.get('address') as Address) || emptyAddress(),
    };

    this.form.patchValue(values);
    this.form.get('address')?.updateValueAndValidity();
    this.initialSnapshot = this.snapshotFromForm(values);
    this.passwordForm.reset();
    this.showPasswordSection = false;
    this.updateCanSubmit();
    this.cdr.markForCheck();
  }

  private updateCanSubmit(): void {
    this.canSubmit = this.form.valid && this.hasProfileChanges();
    this.cdr.markForCheck();
  }

  private hasProfileChanges(): boolean {
    if (!this.initialSnapshot) return false;
    return !this.snapshotsEqual(this.initialSnapshot, this.snapshotFromForm(this.form.getRawValue()));
  }

  private snapshotFromForm(value: {
    name?: string | null;
    apelido?: string | null;
    email?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    proFootballIdol?: string | null;
    amateurFootballIdol?: string | null;
    favoriteProTeam?: string | null;
    favoriteAmateurTeam?: string | null;
    showPhoneInProfile?: boolean | null;
    showEmailInProfile?: boolean | null;
    address?: Address | null;
  }): AccountSnapshot {
    return {
      name: (value.name ?? '').trim(),
      apelido: (value.apelido ?? '').trim(),
      email: (value.email ?? '').trim(),
      phone: (value.phone ?? '').trim(),
      birthDate: value.birthDate ?? '',
      proFootballIdol: (value.proFootballIdol ?? '').trim(),
      amateurFootballIdol: (value.amateurFootballIdol ?? '').trim(),
      favoriteProTeam: (value.favoriteProTeam ?? '').trim(),
      favoriteAmateurTeam: (value.favoriteAmateurTeam ?? '').trim(),
      showPhoneInProfile: !!value.showPhoneInProfile,
      showEmailInProfile: !!value.showEmailInProfile,
      address: value.address ?? emptyAddress(),
    };
  }

  private snapshotsEqual(a: AccountSnapshot, b: AccountSnapshot): boolean {
    return (
      a.name === b.name &&
      a.apelido === b.apelido &&
      a.email === b.email &&
      a.phone === b.phone &&
      a.birthDate === b.birthDate &&
      a.proFootballIdol === b.proFootballIdol &&
      a.amateurFootballIdol === b.amateurFootballIdol &&
      a.favoriteProTeam === b.favoriteProTeam &&
      a.favoriteAmateurTeam === b.favoriteAmateurTeam &&
      a.showPhoneInProfile === b.showPhoneInProfile &&
      a.showEmailInProfile === b.showEmailInProfile &&
      this.addressesEqual(a.address, b.address)
    );
  }

  private addressesEqual(a: Address, b: Address): boolean {
    return (
      (a.street ?? '').trim() === (b.street ?? '').trim() &&
      (a.neighborhood ?? '').trim() === (b.neighborhood ?? '').trim() &&
      (a.city ?? '').trim() === (b.city ?? '').trim() &&
      (a.state ?? '').trim() === (b.state ?? '').trim() &&
      (a.zipCode ?? '').trim() === (b.zipCode ?? '').trim() &&
      (a.latitude ?? null) === (b.latitude ?? null) &&
      (a.longitude ?? null) === (b.longitude ?? null)
    );
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}

import { Component } from '@angular/core';

import { FormBuilder, Validators } from '@angular/forms';

import { Router } from '@angular/router';

import { AlertController, LoadingController } from '@ionic/angular';

import { AthleteMaritalStatus, AthleteFootPreference, heightCmToParts, partsToHeightCm } from '../../core/models/athlete-profile.model';

import { AthleteProfileService } from '../../core/services/athlete-profile.service';

import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';



@Component({

  selector: 'app-athlete-profile-form',

  templateUrl: './athlete-profile-form.page.html',

  styleUrls: ['./athlete-profile-form.page.scss'],

  standalone: false,

})

export class AthleteProfileFormPage {

  hasProfile = false;



  form = this.fb.group({

    primaryPosition: ['', Validators.required],

    secondaryPosition: [''],

    thirdPosition: [''],

    shoeSize: [null as number | null, Validators.required],

    heightMeter: [null as number | null, Validators.required],

    heightCm: [null as number | null, Validators.required],

    weight: [null as number | null, Validators.required],

    footPreference: [''],
    maritalStatus: [''],
    peladaRate: [null as number | null],

    teamMatchRate: [null as number | null],

  });



  constructor(

    private readonly fb: FormBuilder,

    private readonly athleteProfileService: AthleteProfileService,

    private readonly router: Router,

    private readonly loadingCtrl: LoadingController,

    private readonly alertCtrl: AlertController

  ) {}



  async ionViewWillEnter(): Promise<void> {

    const profile = await this.athleteProfileService.getForCurrentUser();

    if (!profile) return;



    this.hasProfile = true;

    const { meter, centimeters } = heightCmToParts(profile.height);

    this.form.patchValue({

      primaryPosition: profile.primaryPosition,

      secondaryPosition: profile.secondaryPosition ?? '',

      thirdPosition: profile.thirdPosition ?? '',

      shoeSize: profile.shoeSize,

      heightMeter: meter,

      heightCm: centimeters,

      weight: profile.weight,

      footPreference: profile.footPreference ?? '',
      maritalStatus: profile.maritalStatus ?? '',
      peladaRate: profile.peladaRate ?? null,

      teamMatchRate: profile.teamMatchRate ?? null,

    });

  }



  cancel(): void {

    void this.router.navigateByUrl('/tabs/profile');

  }



  async submit(): Promise<void> {

    if (this.form.invalid) {

      this.form.markAllAsTouched();

      const message = buildMissingFieldsMessage(this.form, {

        primaryPosition: 'Posicao principal',

        shoeSize: 'Numero do pe',

        heightMeter: 'Altura (metros)',

        heightCm: 'Altura (centimetros)',

        weight: 'Peso',

      });

      if (message) await this.showError(message);

      return;

    }



    const loading = await this.loadingCtrl.create({

      message: this.hasProfile ? 'Salvando alteracoes...' : 'Salvando...',

    });

    await loading.present();



    try {

      const v = this.form.getRawValue();

      const payload = {

        primaryPosition: v.primaryPosition!,

        secondaryPosition: v.secondaryPosition || undefined,

        thirdPosition: v.thirdPosition || undefined,

        shoeSize: Number(v.shoeSize),

        height: partsToHeightCm(Number(v.heightMeter), Number(v.heightCm)),

        weight: Number(v.weight),

        footPreference: this.normalizeFootPreference(v.footPreference),
        maritalStatus: this.normalizeMaritalStatus(v.maritalStatus),
        peladaRate: v.peladaRate != null ? Number(v.peladaRate) : undefined,

        teamMatchRate: v.teamMatchRate != null ? Number(v.teamMatchRate) : undefined,

      };



      if (this.hasProfile) {

        await this.athleteProfileService.update(payload);

      } else {

        await this.athleteProfileService.create(payload);

      }

      await this.router.navigateByUrl('/tabs/profile', { replaceUrl: true });

    } catch (error: unknown) {

      await this.showError(error instanceof Error ? error.message : 'Nao foi possivel salvar.');

    } finally {

      await loading.dismiss();

    }

  }



  private normalizeFootPreference(value: unknown): AthleteFootPreference | undefined {
    if (value === 'destro' || value === 'ambidestro' || value === 'canhoto') return value;
    return undefined;
  }

  private normalizeMaritalStatus(value: unknown): AthleteMaritalStatus | undefined {
    if (value === 'casado' || value === 'solteiro') return value;
    return undefined;
  }

  private async showError(message: string): Promise<void> {

    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });

    await alert.present();

  }

}


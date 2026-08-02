import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AthleteProfileFormPageRoutingModule } from './athlete-profile-form-routing.module';

import { AthleteProfileFormPage } from './athlete-profile-form.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    AthleteProfileFormPageRoutingModule
  ],
  declarations: [AthleteProfileFormPage]
})
export class AthleteProfileFormPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FanProfileFormPageRoutingModule } from './fan-profile-form-routing.module';
import { FanProfileFormPage } from './fan-profile-form.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    FanProfileFormPageRoutingModule,
  ],
  declarations: [FanProfileFormPage],
})
export class FanProfileFormPageModule {}

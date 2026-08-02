import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { PeladaFormPageRoutingModule } from './pelada-form-routing.module';
import { PeladaFormPage } from './pelada-form.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    PeladaFormPageRoutingModule,
  ],
  declarations: [PeladaFormPage],
})
export class PeladaFormPageModule {}

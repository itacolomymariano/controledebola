import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { RoleProfileFormPageRoutingModule } from './role-profile-form-routing.module';
import { RoleProfileFormPage } from './role-profile-form.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    RoleProfileFormPageRoutingModule,
  ],
  declarations: [RoleProfileFormPage],
})
export class RoleProfileFormPageModule {}

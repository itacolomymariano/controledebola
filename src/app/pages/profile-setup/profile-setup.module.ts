import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { ProfileSetupPageRoutingModule } from './profile-setup-routing.module';
import { ProfileSetupPage } from './profile-setup.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    ProfileSetupPageRoutingModule,
  ],
  declarations: [ProfileSetupPage],
})
export class ProfileSetupPageModule {}

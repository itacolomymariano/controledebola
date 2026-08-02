import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { AthleteProfileHiringPageRoutingModule } from './athlete-profile-hiring-routing.module';
import { AthleteProfileHiringPage } from './athlete-profile-hiring.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    AthleteProfileHiringPageRoutingModule,
  ],
  declarations: [AthleteProfileHiringPage],
})
export class AthleteProfileHiringPageModule {}

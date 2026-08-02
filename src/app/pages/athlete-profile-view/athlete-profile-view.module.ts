import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { AthleteProfileViewPageRoutingModule } from './athlete-profile-view-routing.module';
import { AthleteProfileViewPage } from './athlete-profile-view.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SharedModule,
    AthleteProfileViewPageRoutingModule,
  ],
  declarations: [AthleteProfileViewPage],
})
export class AthleteProfileViewPageModule {}

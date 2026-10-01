import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { TeamProfilePageRoutingModule } from './team-profile-routing.module';
import { TeamProfilePage } from './team-profile.page';

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, TeamProfilePageRoutingModule],
  declarations: [TeamProfilePage],
})
export class TeamProfilePageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { ProfileViewPageRoutingModule } from './profile-view-routing.module';
import { ProfileViewPage } from './profile-view.page';

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, ProfileViewPageRoutingModule],
  declarations: [ProfileViewPage],
})
export class ProfileViewPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventTeamSplitPageRoutingModule } from './event-team-split-routing.module';
import { EventTeamSplitPage } from './event-team-split.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    EventTeamSplitPageRoutingModule,
  ],
  declarations: [EventTeamSplitPage],
})
export class EventTeamSplitPageModule {}

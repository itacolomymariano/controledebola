import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventCoachBoardPageRoutingModule } from './event-coach-board-routing.module';
import { EventCoachBoardPage } from './event-coach-board.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    EventCoachBoardPageRoutingModule,
  ],
  declarations: [EventCoachBoardPage],
})
export class EventCoachBoardPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventPhysicalTrainerPageRoutingModule } from './event-physical-trainer-routing.module';
import { EventPhysicalTrainerPage } from './event-physical-trainer.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    EventPhysicalTrainerPageRoutingModule,
  ],
  declarations: [EventPhysicalTrainerPage],
})
export class EventPhysicalTrainerPageModule {}

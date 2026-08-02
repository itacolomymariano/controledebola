import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventPredictionsPageRoutingModule } from './event-predictions-routing.module';
import { EventPredictionsPage } from './event-predictions.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    EventPredictionsPageRoutingModule,
  ],
  declarations: [EventPredictionsPage],
})
export class EventPredictionsPageModule {}

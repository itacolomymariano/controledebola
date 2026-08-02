import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventMasseurTreatmentsPageRoutingModule } from './event-masseur-treatments-routing.module';
import { EventMasseurTreatmentsPage } from './event-masseur-treatments.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    EventMasseurTreatmentsPageRoutingModule,
  ],
  declarations: [EventMasseurTreatmentsPage],
})
export class EventMasseurTreatmentsPageModule {}

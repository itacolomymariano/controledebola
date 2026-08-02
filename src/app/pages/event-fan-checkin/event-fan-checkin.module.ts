import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventFanCheckInPageRoutingModule } from './event-fan-checkin-routing.module';
import { EventFanCheckInPage } from './event-fan-checkin.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    EventFanCheckInPageRoutingModule,
  ],
  declarations: [EventFanCheckInPage],
})
export class EventFanCheckInPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventSupplementaryHiringPageRoutingModule } from './event-supplementary-hiring-routing.module';
import { EventSupplementaryHiringPage } from './event-supplementary-hiring.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    EventSupplementaryHiringPageRoutingModule,
  ],
  declarations: [EventSupplementaryHiringPage],
})
export class EventSupplementaryHiringPageModule {}

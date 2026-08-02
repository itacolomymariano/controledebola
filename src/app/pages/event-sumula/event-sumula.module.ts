import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventSumulaPageRoutingModule } from './event-sumula-routing.module';
import { EventSumulaPage } from './event-sumula.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    EventSumulaPageRoutingModule,
  ],
  declarations: [EventSumulaPage],
})
export class EventSumulaPageModule {}

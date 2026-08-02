import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventNarratorRadioPageRoutingModule } from './event-narrator-radio-routing.module';
import { EventNarratorRadioPage } from './event-narrator-radio.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, EventNarratorRadioPageRoutingModule],
  declarations: [EventNarratorRadioPage],
})
export class EventNarratorRadioPageModule {}

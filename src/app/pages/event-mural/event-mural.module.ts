import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventMuralPageRoutingModule } from './event-mural-routing.module';
import { EventMuralPage } from './event-mural.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    EventMuralPageRoutingModule,
  ],
  declarations: [EventMuralPage],
})
export class EventMuralPageModule {}

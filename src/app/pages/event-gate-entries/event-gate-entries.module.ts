import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { EventGateEntriesPageRoutingModule } from './event-gate-entries-routing.module';
import { EventGateEntriesPage } from './event-gate-entries.page';

@NgModule({
  imports: [CommonModule, IonicModule, EventGateEntriesPageRoutingModule],
  declarations: [EventGateEntriesPage],
})
export class EventGateEntriesPageModule {}

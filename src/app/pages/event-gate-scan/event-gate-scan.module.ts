import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventGateScanPageRoutingModule } from './event-gate-scan-routing.module';
import { EventGateScanPage } from './event-gate-scan.page';

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, EventGateScanPageRoutingModule],
  declarations: [EventGateScanPage],
})
export class EventGateScanPageModule {}

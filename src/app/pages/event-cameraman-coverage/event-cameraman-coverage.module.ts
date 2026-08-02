import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventCameramanCoveragePageRoutingModule } from './event-cameraman-coverage-routing.module';
import { EventCameramanCoveragePage } from './event-cameraman-coverage.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    EventCameramanCoveragePageRoutingModule,
  ],
  declarations: [EventCameramanCoveragePage],
})
export class EventCameramanCoveragePageModule {}

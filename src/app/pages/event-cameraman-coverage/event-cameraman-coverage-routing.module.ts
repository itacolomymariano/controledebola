import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventCameramanCoveragePage } from './event-cameraman-coverage.page';

const routes: Routes = [{ path: '', component: EventCameramanCoveragePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventCameramanCoveragePageRoutingModule {}

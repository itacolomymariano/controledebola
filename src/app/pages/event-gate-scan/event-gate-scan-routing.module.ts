import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventGateScanPage } from './event-gate-scan.page';

const routes: Routes = [{ path: '', component: EventGateScanPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventGateScanPageRoutingModule {}

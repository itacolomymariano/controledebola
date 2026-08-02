import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventFanCheckInPage } from './event-fan-checkin.page';

const routes: Routes = [{ path: '', component: EventFanCheckInPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventFanCheckInPageRoutingModule {}

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventGateEntriesPage } from './event-gate-entries.page';

const routes: Routes = [{ path: '', component: EventGateEntriesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventGateEntriesPageRoutingModule {}

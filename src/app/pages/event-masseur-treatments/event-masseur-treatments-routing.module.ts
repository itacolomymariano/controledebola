import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventMasseurTreatmentsPage } from './event-masseur-treatments.page';

const routes: Routes = [{ path: '', component: EventMasseurTreatmentsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventMasseurTreatmentsPageRoutingModule {}

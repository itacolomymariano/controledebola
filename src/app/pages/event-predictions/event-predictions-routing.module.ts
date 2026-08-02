import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventPredictionsPage } from './event-predictions.page';

const routes: Routes = [
  {
    path: '',
    component: EventPredictionsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventPredictionsPageRoutingModule {}

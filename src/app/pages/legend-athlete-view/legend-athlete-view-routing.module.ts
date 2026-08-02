import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LegendAthleteViewPage } from './legend-athlete-view.page';

const routes: Routes = [
  {
    path: '',
    component: LegendAthleteViewPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LegendAthleteViewPageRoutingModule {}

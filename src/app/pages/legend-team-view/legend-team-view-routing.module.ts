import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LegendTeamViewPage } from './legend-team-view.page';

const routes: Routes = [
  {
    path: '',
    component: LegendTeamViewPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LegendTeamViewPageRoutingModule {}

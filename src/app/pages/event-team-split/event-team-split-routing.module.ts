import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventTeamSplitPage } from './event-team-split.page';

const routes: Routes = [
  {
    path: '',
    component: EventTeamSplitPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventTeamSplitPageRoutingModule {}

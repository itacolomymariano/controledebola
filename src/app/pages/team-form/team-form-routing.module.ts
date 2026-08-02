import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TeamFormPage } from './team-form.page';

const routes: Routes = [
  {
    path: '',
    component: TeamFormPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TeamFormPageRoutingModule {}

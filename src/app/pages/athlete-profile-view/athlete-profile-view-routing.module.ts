import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AthleteProfileViewPage } from './athlete-profile-view.page';

const routes: Routes = [
  {
    path: '',
    component: AthleteProfileViewPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AthleteProfileViewPageRoutingModule {}

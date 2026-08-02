import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AthleteProfileFormPage } from './athlete-profile-form.page';

const routes: Routes = [
  {
    path: '',
    component: AthleteProfileFormPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AthleteProfileFormPageRoutingModule {}

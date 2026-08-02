import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AthleteProfileHiringPage } from './athlete-profile-hiring.page';

const routes: Routes = [{ path: '', component: AthleteProfileHiringPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AthleteProfileHiringPageRoutingModule {}

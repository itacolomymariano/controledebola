import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FanProfileFormPage } from './fan-profile-form.page';

const routes: Routes = [{ path: '', component: FanProfileFormPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FanProfileFormPageRoutingModule {}

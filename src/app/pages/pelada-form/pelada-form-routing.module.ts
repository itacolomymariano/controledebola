import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PeladaFormPage } from './pelada-form.page';

const routes: Routes = [{ path: '', component: PeladaFormPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PeladaFormPageRoutingModule {}

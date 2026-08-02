import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PeladaDetailPage } from './pelada-detail.page';

const routes: Routes = [{ path: '', component: PeladaDetailPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PeladaDetailPageRoutingModule {}

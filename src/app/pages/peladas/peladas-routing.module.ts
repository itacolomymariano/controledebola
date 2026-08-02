import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PeladasPage } from './peladas.page';

const routes: Routes = [{ path: '', component: PeladasPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PeladasPageRoutingModule {}

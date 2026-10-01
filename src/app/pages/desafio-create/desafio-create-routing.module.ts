import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DesafioCreatePage } from './desafio-create.page';

const routes: Routes = [{ path: '', component: DesafioCreatePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DesafioCreatePageRoutingModule {}

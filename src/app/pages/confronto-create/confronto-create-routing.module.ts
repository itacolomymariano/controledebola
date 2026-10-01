import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfrontoCreatePage } from './confronto-create.page';

const routes: Routes = [{ path: '', component: ConfrontoCreatePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConfrontoCreatePageRoutingModule {}

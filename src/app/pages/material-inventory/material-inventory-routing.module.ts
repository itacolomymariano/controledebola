import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MaterialInventoryPage } from './material-inventory.page';

const routes: Routes = [{ path: '', component: MaterialInventoryPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MaterialInventoryPageRoutingModule {}

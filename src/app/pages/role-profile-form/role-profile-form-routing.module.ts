import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RoleProfileFormPage } from './role-profile-form.page';

const routes: Routes = [
  {
    path: '',
    component: RoleProfileFormPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RoleProfileFormPageRoutingModule {}

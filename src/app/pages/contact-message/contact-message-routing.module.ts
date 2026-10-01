import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ContactMessagePage } from './contact-message.page';

const routes: Routes = [
  {
    path: ':kind',
    component: ContactMessagePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ContactMessagePageRoutingModule {}

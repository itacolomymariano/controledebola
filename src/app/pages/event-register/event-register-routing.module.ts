import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EventRegisterPage } from './event-register.page';

const routes: Routes = [
  {
    path: '',
    component: EventRegisterPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventRegisterPageRoutingModule {}

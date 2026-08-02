import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventSumulaPage } from './event-sumula.page';

const routes: Routes = [
  {
    path: '',
    component: EventSumulaPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventSumulaPageRoutingModule {}

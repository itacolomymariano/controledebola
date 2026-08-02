import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventScoutApontamentoPage } from './event-scout-apontamento.page';

const routes: Routes = [
  {
    path: '',
    component: EventScoutApontamentoPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventScoutApontamentoPageRoutingModule {}

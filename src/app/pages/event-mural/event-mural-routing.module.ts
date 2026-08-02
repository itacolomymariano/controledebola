import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventMuralPage } from './event-mural.page';

const routes: Routes = [
  { path: '', component: EventMuralPage },
  {
    path: 'media',
    loadChildren: () =>
      import('../event-mural-media/event-mural-media.module').then((m) => m.EventMuralMediaPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventMuralPageRoutingModule {}

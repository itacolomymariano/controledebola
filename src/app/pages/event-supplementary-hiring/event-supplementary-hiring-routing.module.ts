import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventSupplementaryHiringPage } from './event-supplementary-hiring.page';

const routes: Routes = [{ path: '', component: EventSupplementaryHiringPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventSupplementaryHiringPageRoutingModule {}

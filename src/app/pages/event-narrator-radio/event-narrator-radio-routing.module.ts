import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventNarratorRadioPage } from './event-narrator-radio.page';

const routes: Routes = [{ path: '', component: EventNarratorRadioPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventNarratorRadioPageRoutingModule {}

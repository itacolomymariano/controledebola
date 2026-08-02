import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventPhysicalTrainerPage } from './event-physical-trainer.page';

const routes: Routes = [{ path: '', component: EventPhysicalTrainerPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventPhysicalTrainerPageRoutingModule {}

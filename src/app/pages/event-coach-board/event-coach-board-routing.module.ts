import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventCoachBoardPage } from './event-coach-board.page';

const routes: Routes = [{ path: '', component: EventCoachBoardPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventCoachBoardPageRoutingModule {}

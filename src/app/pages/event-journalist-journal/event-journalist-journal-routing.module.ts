import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventJournalistJournalPage } from './event-journalist-journal.page';

const routes: Routes = [{ path: '', component: EventJournalistJournalPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventJournalistJournalPageRoutingModule {}

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventMuralMediaHubPage } from './event-mural-media-hub.page';
import { EventMuralMediaRadioPage } from './event-mural-media-radio.page';
import { EventMuralMediaJournalPage } from './event-mural-media-journal.page';
import { EventMuralMediaVideoPage } from './event-mural-media-video.page';

const routes: Routes = [
  { path: '', component: EventMuralMediaHubPage },
  { path: 'radio', component: EventMuralMediaRadioPage },
  { path: 'journal', component: EventMuralMediaJournalPage },
  { path: 'video', component: EventMuralMediaVideoPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventMuralMediaPageRoutingModule {}

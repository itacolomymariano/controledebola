import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventMuralMediaPageRoutingModule } from './event-mural-media-routing.module';
import { EventMuralMediaHubPage } from './event-mural-media-hub.page';
import { EventMuralMediaRadioPage } from './event-mural-media-radio.page';
import { EventMuralMediaJournalPage } from './event-mural-media-journal.page';
import { EventMuralMediaVideoPage } from './event-mural-media-video.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, EventMuralMediaPageRoutingModule],
  declarations: [
    EventMuralMediaHubPage,
    EventMuralMediaRadioPage,
    EventMuralMediaJournalPage,
    EventMuralMediaVideoPage,
  ],
})
export class EventMuralMediaPageModule {}

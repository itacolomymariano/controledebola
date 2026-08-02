import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventJournalistJournalPageRoutingModule } from './event-journalist-journal-routing.module';
import { EventJournalistJournalPage } from './event-journalist-journal.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, EventJournalistJournalPageRoutingModule],
  declarations: [EventJournalistJournalPage],
})
export class EventJournalistJournalPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { InboxPageRoutingModule } from './inbox-routing.module';
import { InboxPage } from './inbox.page';

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, InboxPageRoutingModule],
  declarations: [InboxPage],
})
export class InboxPageModule {}

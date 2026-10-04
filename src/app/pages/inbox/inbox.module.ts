import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { InboxPageRoutingModule } from './inbox-routing.module';
import { InboxPage } from './inbox.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, InboxPageRoutingModule],
  declarations: [InboxPage],
})
export class InboxPageModule {}

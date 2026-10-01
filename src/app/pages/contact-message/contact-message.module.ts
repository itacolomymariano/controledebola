import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { ContactMessagePageRoutingModule } from './contact-message-routing.module';
import { ContactMessagePage } from './contact-message.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    ContactMessagePageRoutingModule,
  ],
  declarations: [ContactMessagePage],
})
export class ContactMessagePageModule {}

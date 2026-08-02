import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EventRegisterPageRoutingModule } from './event-register-routing.module';

import { EventRegisterPage } from './event-register.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    EventRegisterPageRoutingModule
  ],
  declarations: [EventRegisterPage]
})
export class EventRegisterPageModule {}

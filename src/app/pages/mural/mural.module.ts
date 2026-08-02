import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { MuralPageRoutingModule } from './mural-routing.module';

import { MuralPage } from './mural.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SharedModule,
    MuralPageRoutingModule
  ],
  declarations: [MuralPage]
})
export class MuralPageModule {}

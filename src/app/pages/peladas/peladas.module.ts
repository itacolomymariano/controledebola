import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { PeladasPageRoutingModule } from './peladas-routing.module';
import { PeladasPage } from './peladas.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, PeladasPageRoutingModule],
  declarations: [PeladasPage],
})
export class PeladasPageModule {}

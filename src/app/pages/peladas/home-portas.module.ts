import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { HomePortasPageRoutingModule } from './home-portas-routing.module';
import { PeladasPage } from './peladas.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, HomePortasPageRoutingModule],
  declarations: [PeladasPage],
})
export class HomePortasPageModule {}

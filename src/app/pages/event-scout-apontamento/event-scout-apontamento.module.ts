import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { EventScoutApontamentoPageRoutingModule } from './event-scout-apontamento-routing.module';
import { EventScoutApontamentoPage } from './event-scout-apontamento.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    EventScoutApontamentoPageRoutingModule,
  ],
  declarations: [EventScoutApontamentoPage],
})
export class EventScoutApontamentoPageModule {}

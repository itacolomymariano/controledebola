import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { LegendsHubPageRoutingModule } from './legends-hub-routing.module';
import { LegendsHubPage } from './legends-hub.page';

@NgModule({
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, SharedModule, LegendsHubPageRoutingModule],
  declarations: [LegendsHubPage],
})
export class LegendsHubPageModule {}

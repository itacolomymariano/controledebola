import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { LegendAthleteViewPageRoutingModule } from './legend-athlete-view-routing.module';
import { LegendAthleteViewPage } from './legend-athlete-view.page';

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, LegendAthleteViewPageRoutingModule],
  declarations: [LegendAthleteViewPage],
})
export class LegendAthleteViewPageModule {}

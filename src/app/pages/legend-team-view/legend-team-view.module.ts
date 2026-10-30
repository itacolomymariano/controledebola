import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { LegendTeamViewPageRoutingModule } from './legend-team-view-routing.module';
import { LegendTeamViewPage } from './legend-team-view.page';

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, LegendTeamViewPageRoutingModule],
  declarations: [LegendTeamViewPage],
})
export class LegendTeamViewPageModule {}

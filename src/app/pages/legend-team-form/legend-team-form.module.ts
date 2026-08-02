import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { LegendTeamFormPageRoutingModule } from './legend-team-form-routing.module';
import { LegendTeamFormPage } from './legend-team-form.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    LegendTeamFormPageRoutingModule,
  ],
  declarations: [LegendTeamFormPage],
})
export class LegendTeamFormPageModule {}

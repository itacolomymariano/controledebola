import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { LegendAthleteFormPageRoutingModule } from './legend-athlete-form-routing.module';
import { LegendAthleteFormPage } from './legend-athlete-form.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    LegendAthleteFormPageRoutingModule,
  ],
  declarations: [LegendAthleteFormPage],
})
export class LegendAthleteFormPageModule {}

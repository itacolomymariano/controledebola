import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { LegendProAthleteFormPageRoutingModule } from './legend-pro-athlete-form-routing.module';
import { LegendProAthleteFormPage } from './legend-pro-athlete-form.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    LegendProAthleteFormPageRoutingModule,
  ],
  declarations: [LegendProAthleteFormPage],
})
export class LegendProAthleteFormPageModule {}

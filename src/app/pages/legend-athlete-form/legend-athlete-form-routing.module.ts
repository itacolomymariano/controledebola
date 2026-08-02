import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LegendAthleteFormPage } from './legend-athlete-form.page';

const routes: Routes = [{ path: '', component: LegendAthleteFormPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LegendAthleteFormPageRoutingModule {}

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LegendProAthleteFormPage } from './legend-pro-athlete-form.page';

const routes: Routes = [
  {
    path: '',
    component: LegendProAthleteFormPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LegendProAthleteFormPageRoutingModule {}

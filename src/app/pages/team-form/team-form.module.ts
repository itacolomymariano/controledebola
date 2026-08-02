import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { TeamFormPageRoutingModule } from './team-form-routing.module';
import { TeamFormPage } from './team-form.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    TeamFormPageRoutingModule,
  ],
  declarations: [TeamFormPage],
})
export class TeamFormPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { DesafioCreatePageRoutingModule } from './desafio-create-routing.module';
import { DesafioCreatePage } from './desafio-create.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    DesafioCreatePageRoutingModule,
  ],
  declarations: [DesafioCreatePage],
})
export class DesafioCreatePageModule {}

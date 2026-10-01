import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { ConfrontoCreatePageRoutingModule } from './confronto-create-routing.module';
import { ConfrontoCreatePage } from './confronto-create.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    ConfrontoCreatePageRoutingModule,
  ],
  declarations: [ConfrontoCreatePage],
})
export class ConfrontoCreatePageModule {}

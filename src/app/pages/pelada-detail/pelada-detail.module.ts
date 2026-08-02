import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { PeladaDetailPageRoutingModule } from './pelada-detail-routing.module';
import { PeladaDetailPage } from './pelada-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    PeladaDetailPageRoutingModule,
  ],
  declarations: [PeladaDetailPage],
})
export class PeladaDetailPageModule {}

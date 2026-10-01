import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { AboutPageRoutingModule } from './about-routing.module';
import { AboutPage } from './about.page';

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, AboutPageRoutingModule],
  declarations: [AboutPage],
})
export class AboutPageModule {}

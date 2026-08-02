import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AboutPageRoutingModule } from './about-routing.module';
import { AboutPage } from './about.page';

@NgModule({
  imports: [CommonModule, IonicModule, AboutPageRoutingModule],
  declarations: [AboutPage],
})
export class AboutPageModule {}

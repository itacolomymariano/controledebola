import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { HomeDirectoryPage } from './home-directory.page';
import { HomeUsuarioPage } from './home-usuario.page';
import { PeladasListPage } from './peladas-list.page';
import { PeladasPageRoutingModule } from './peladas-routing.module';
import { PeladasPage } from './peladas.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, PeladasPageRoutingModule],
  declarations: [PeladasPage, PeladasListPage, HomeDirectoryPage, HomeUsuarioPage],
})
export class PeladasPageModule {}

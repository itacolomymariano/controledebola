import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MaterialInventoryPageRoutingModule } from './material-inventory-routing.module';
import { MaterialInventoryPage } from './material-inventory.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, MaterialInventoryPageRoutingModule],
  declarations: [MaterialInventoryPage],
})
export class MaterialInventoryPageModule {}

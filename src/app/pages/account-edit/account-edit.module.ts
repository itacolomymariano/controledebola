import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { AccountEditPageRoutingModule } from './account-edit-routing.module';
import { AccountEditPage } from './account-edit.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharedModule,
    AccountEditPageRoutingModule,
  ],
  declarations: [AccountEditPage],
})
export class AccountEditPageModule {}

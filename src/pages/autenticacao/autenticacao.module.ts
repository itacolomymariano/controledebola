import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AutenticacaoPage } from './autenticacao';
import { FacebookProvider } from '../../providers/facebook/facebook';

@NgModule({
  declarations: [
    AutenticacaoPage,
  ],
  imports: [
    IonicPageModule.forChild(AutenticacaoPage),
    FacebookProvider
  ],
})
export class AutenticacaoPageModule {};

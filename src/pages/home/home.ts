import { Component } from '@angular/core';
//import { IonicPage, NavController, NavParams } from 'ionic-angular';
//import { NavController, NavParams } from 'ionic-angular';
import { NavController } from 'ionic-angular';
import { ConfigProvider } from '../../providers/config/config';
//import { AutenticacaoPage } from '../autenticacao/autenticacao';
//import { SobrePage } from '../sobre/sobre';
//import { PerfilPage } from '../perfil/perfil';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  //rootPage = HomePage;
  //rootPage = PerfilPage;
  public nomeUsuario: string;
  public fcpathfoto: string;
  constructor(public navCtrl: NavController,
              public configProvider: ConfigProvider
  ) {
    let config = configProvider.getConfigDate();
    this.nomeUsuario = JSON.parse(localStorage.getItem('config')).username;
    this.fcpathfoto = JSON.parse(localStorage.getItem('config')).fbfoto;
    
    //console.log('Estou no HomePage: nomeUsuario: ',this.nomeUsuario)
    //console.log('Estou no HomePage: this.configProvider.cb_username: ',this.configProvider.cb_username)

  }

} //Fim da class HomePage

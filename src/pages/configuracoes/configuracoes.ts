import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform } from 'ionic-angular';
import { PerfilPage } from '../perfil/perfil';
import { SobrePage } from '../sobre/sobre';
import { AutenticacaoPage } from '../autenticacao/autenticacao';
import { ConfigProvider } from '../../providers/config/config';
import * as Parse from 'parse';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
import { Http, Response } from "@angular/http";
import 'rxjs/add/operator/map';
//import { HttpModule } from '@angular/http';
// To set the server URL
let parse = require('parse');

/**
 * Generated class for the ConfiguracoesPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-configuracoes',
  templateUrl: 'configuracoes.html',
})
export class ConfiguracoesPage {
  rootPage = PerfilPage;
  pages: any;
  constructor(public navCtrl: NavController, 
              public navParams: NavParams,
              public platform: Platform, 
              public statusBar: StatusBar, 
              public splashScreen: SplashScreen,//, public dataService: DataService
              public configProvider: ConfigProvider,
              public http: Http,
              
            ) {
              let localData = this.http.get('../assets/data/menus.json').map((response:Response)=>response.json().items);
              localData.subscribe(data=>{
                this.pages = data;
              })
  }

  //ionViewDidLoad() {
  ionViewDidEnter() {
    //console.log('ionViewDidLoad ConfiguracoesPage');
    //console.log('ionViewDidEnter ConfiguracoesPage');
    /*
      this.configProvider.getMenus().subscribe((response)=> {
        this.pages = response;
        console.log(this.pages);
    });
    */
  }
  //Ita - 24/04/2018 - Primeiro Nível do Menu
  toggleSection(i){
    this.pages[i].open = !this.pages[i].open;
  }
  //Ita - 24/04/2018 - Segundo Nível do Menu
  toggleItem(i, j){
    this.pages[i].subs[j].open = !this.pages[i].subs[j].open;
  }

  //Ita - 24/04/2018 - Terceiro Nível do Menu
  toggleSubItem(i, j, w){
    this.pages[i].subs[j].open.manufactures[w].open = !this.pages[i].subs[j].open.manufactures[w].open
  }

  //Ita - 25/04/2018 - Redireciona para Páginal do Próprio Perfil
  showMyProfile() {
    return this.navCtrl.push(PerfilPage);
  }
  

  openPerfil() {
    this.navCtrl.push(PerfilPage); //Ita - 04/03/2018 - Função navCtrl faz a mágica de abrir a página.
  }
  
  openSobre() {
    this.navCtrl.push(SobrePage);
  }

  sairCB() {  //Ita - 28/03/2018
    //var currentUser = Parse.User.current(); //Ita - 27/03/2018 - Verifica se o usuário está logado. 
    Parse.User.logOut().then(() => {
      //console.log('Fiz logout')
      //var currentUser = Parse.User.current();  // this will now be null
      //console.log('Após logout currentUser: ',currentUser)
      this.navCtrl.push(AutenticacaoPage);
    });
    //this.navCtrl.push(AutenticacaoPage);
  }
}

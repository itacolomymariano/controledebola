//import { Component, ViewChild } from '@angular/core';
import { Component } from '@angular/core';
//import { Component, ElementRef, OnInit } from '@angular/core';
//import { FormControl } from '@angular/forms';

//import { NavController } from 'ionic-angular';
import { Platform } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
//import { TabsPage } from '../pages/tabs/tabs';
import { IntroPage } from '../pages/intro/intro';
import { ConfigProvider } from '../providers/config/config';

//Ita - 16/03/2018 - PARSE SDK - Conectar controledebola ao back4app
//import 'es6-shim';
//import {App, IonicApp, MenuController} from 'ionic-angular';
// *** import { Parse } from  "../../node_modules/parse/lib/node/parse.js"
import * as Parse from 'parse';
//import { Usuario } from '../pages/autenticacao/usuario.model';
import { AutenticacaoPage } from '../pages/autenticacao/autenticacao';
// To set the server URL
let parse = require('parse');

@Component({
  template: '<ion-nav #myNav [root]="rootPage"></ion-nav>',
  //templateUrl: 'app.html',
  providers: [
    ConfigProvider
  ]
  
})
export class MyApp {
  //arraydados: any;
  //@ViewChild('myNav') nav: NavController
  //rootPage:any = IntroPage; //Antes = rootPage:any = TabsPage;
  rootPage:any;
  Parse: any; //Ita - 16/03/2018 - PARSE SDK - conectar Back4app
 
  constructor(platform: Platform, 
              statusBar: StatusBar, 
              splashScreen: SplashScreen,
              configProvider: ConfigProvider/*,
              autenticacaoPage: AutenticacaoPage*/
            ) {
    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      let config = configProvider.getConfigDate();
      //console.log('config: ',config);
      if(config == null){ 
        //console.log('config é nulo, salvando localstorage...');
        this.rootPage = IntroPage;
        configProvider.setConfigData(false);
        
      } else {
        //console.log('exibindo TabsPage...');
        //this.rootPage = TabsPage;
        this.rootPage = AutenticacaoPage;
      }
      //console.log('Teste de Ita');
      statusBar.styleDefault();
      splashScreen.hide();

    
      //Ita - 03/07/2017 - Inicializar PARSE SDK - Primeiro Parâmetro('APPLICATION_ID'), Segundo Parâmetro (JAVASCRIPT_KEY')
      parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');
      parse.serverURL = 'https://parseapi.back4app.com/';
      //Parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk');
      
    }); //Fim do then de platform.ready().then
  } //Ita - 22/03/2018 - Fim do Contructor

} //Fim da Classe MyApp

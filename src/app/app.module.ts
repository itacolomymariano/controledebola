//import { NgModule, ErrorHandler,InjectionToken } from '@angular/core';
import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { MyApp } from './app.component';

//import { AboutPage } from '../pages/about/about';
//import { ContactPage } from '../pages/contact/contact';
import { HomePage } from '../pages/home/home';
import { TabsPage } from '../pages/tabs/tabs';

import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';

import {HttpModule} from '@angular/http';
import { FeedPageModule } from '../pages/feed/feed.module';
import { IntroPageModule } from '../pages/intro/intro.module';
import { HttpClientModule } from '@angular/common/http';
import { ConfiguracoesPageModule } from '../pages/configuracoes/configuracoes.module';
import { SobrePageModule } from '../pages/sobre/sobre.module';
import { PerfilPageModule } from '../pages/perfil/perfil.module';
import { FilmedetalhesPageModule } from '../pages/filmedetalhes/filmedetalhes.module';
import { CartolaProvider } from '../providers/cartola/cartola';
import { AtletasPageModule } from '../pages/atletas/atletas.module';
//import { AutenticacaoPageModule } from '../pages/autenticacao/autenticacao.module';
import { AutenticacaoPage } from '../pages/autenticacao/autenticacao';
import { FacebookProvider } from '../providers/facebook/facebook';
import { LoginPage } from '../pages/login/login';
import { IonicStorageModule } from '@ionic/storage';//Ita - 23/03/2018 - Uso do Storage
//Ita - 08/04/2018 - Permitir Download e Upload de Arquivos
//import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer';
import { FileTransfer } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { FilePath } from '@ionic-native/file-path';
//import { CbmaskgenDirective } from '../directives/cbmaskgen/cbmaskgen';
import { CurrencyPipe } from '@angular/common';
//import { DatePicker } from '@ionic-native/date-picker';
//import {NgxMaskModule} from 'ngx-mask';
//import { NgxMaskModule, initialConfig, MaskService } from 'ngx-mask';
//import { InputMaskModule } from 'ionic-input-mask';
import { BrMaskerModule } from 'brmasker-ionic-3';
import {TextMaskModule} from 'angular2-text-mask';



@NgModule({
  declarations: [
    // ... aqui os components que serão usados apenas ná página atual
    MyApp,
  //  AboutPage,
  //  ContactPage,
    HomePage,
    TabsPage,
    AutenticacaoPage,
    LoginPage
    /*,
    FileTransfer,
    File
    */
  ],
  imports: [
    BrowserModule,
    HttpModule,
    IonicModule.forRoot(MyApp),
    FeedPageModule,
    IntroPageModule,
    HttpModule,
    HttpClientModule,
    ConfiguracoesPageModule,
    SobrePageModule,
    PerfilPageModule,
    FilmedetalhesPageModule,
    AtletasPageModule,
    IonicStorageModule.forRoot({
      name: '__mydb',
         driverOrder: ['indexeddb', 'sqlite', 'websql']
    }),    //Ita - 23/03/2018 - Uso do Storage
    //BrMaskerModule
    //CbmaskgenDirective
    /*,FileTransfer,
    File
    */
      /*,
    AutenticacaoPageModule*/
    
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    // ... importe componente que irão ser compartilhados entre si
    MyApp,
    //AboutPage,
    //ContactPage,
    HomePage,
    TabsPage,
    AutenticacaoPage,
    LoginPage,/*,
    FileTransfer,
    File
    */
  ],
  providers: [
    // ... serviços especificos das libs
    StatusBar,
    SplashScreen,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    CartolaProvider,
    FacebookProvider,
    FileTransfer,
    File,
    FilePath,
    CurrencyPipe,
    BrMaskerModule,
    TextMaskModule
    //CbmaskgenDirective
    //MaskService
   // DatePicker
    
  ]
})
export class AppModule {}

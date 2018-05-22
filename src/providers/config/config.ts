//import { Component } from '@angular/core';
import { Injectable } from '@angular/core';
//import { Usuario } from '../../pages/autenticacao/usuario.model';
//import { TabsPage } from '../../pages/tabs/tabs';
import { AlertController } from 'ionic-angular';
//Ita - 08/04/2018 - Permitir Download e Upload de Arquivos
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { FilePath } from '@ionic-native/file-path';
//import { Http, Response } from "@angular/http";
//import 'rxjs/add/operator/map';


import * as Parse from 'parse';
// To set the server URL
//let parse = require('parse');

let config_key_name = "config"
/*
Ita - 03/03/2018 - M o d u l o   C o f i g u r a d o r
*/
@Injectable()
export class ConfigProvider {
  //public dadoslogin = new Usuario();
  public cb_username: any;  //Ita - 23/03/2018

  public type = 'password'; //Ita - 24/03/2018 - Mostrar/Ocultar senha nos forms de login.
  public showPass = false;
/*
  private config = {
    showSlide: false,
    name: '',
    username: '',
    fbfoto:'',
    autentic:false,
    email:''
  }*/
/*
  public userRoles = {
    "id": '',
    "name": ''
  }
  */
 public userRoles = [];
  
    //constructor(@Inject(Platform) platform, @Inject(NavController) navController) {
  //}
  constructor(private alertCtrl: AlertController,
              private transfer: FileTransfer,
              private file: File,
              private filePath: FilePath,
              //private http: Http,
              //private response: Response
            ) {

  }
   //Observação: O localstorage funciona como string, portanto o mesmo
   //            não aceita nada diferente de string.
                    
  //Recuperar Dados do localstorage
  getConfigDate(): any{
    return localStorage.getItem(config_key_name);
  }
  //Grava Dados no localstorage
  // O atributo ?: indica que o parâmetro não é obrigatório.
    
  /*
    setConfigDate(showSlide?: boolean,name?: string, username?: string,
                  codigo?: number,nome?: string,email?: string,login?: string,
                  senha?: string,foto?: string,
    */
  
// Grava os dados do localstorage
setConfigData(showSlide?: boolean, name?: string, username?: string, fbfoto?:string,autentic?: boolean, email?:string){
  let config = {
      showSlide: false,
      name: "",
      username: "",
      fbfoto: "",
      autentic: false,
      email:''
  };
  if(showSlide){
    config.showSlide = showSlide;
  }

  if(name){
    config.name = name;
  }

  if(username){
    config.username = username;
  }

  if(fbfoto){
    config.fbfoto = fbfoto;
  }

  if(autentic){
    config.autentic = autentic;
  }

  if(email){
    config.email = email;
  }

  localStorage.setItem(config_key_name, JSON.stringify(config));
} //Fim do setConfigDate

  //Ita - 24/03/2018 - Mostrar/Ocultar Senha nos Forms de Login
  showPassword() {

    this.showPass = !this.showPass;
    //console.log('Estou no showPassword() - ',this.showPass)
    if(this.showPass){
      //console.log('Mostra Senha')
      this.type = 'text';
    } else {
      //console.log('Oculta Senha')
      this.type = 'password';
    }

  } //Fim do metodo showPassword()

  presentPrompt(nomeusu: string,coderro,tit_alert:any,msg_alert:any) {
    
    let alert = this.alertCtrl.create({

      title: tit_alert, //'Login Inválido',
      message: msg_alert, //'Usuário ' + nomeusu + ' não cadastrado ou senha incorreta! ' + ' Código do Erro [' + coderro + ']',
      //cssClass: '', //Ita - 27/08/2018 - Definir propriedade de design da janela Alert
      
      /*
      inputs: [
        {
          name: 'username',
          placeholder: 'Username'
        },
        {
          name: 'password',
          placeholder: 'Password',
          type: 'password'
        }
      ],*/
      buttons: [
        {
          text: 'Ok',
          role: 'cancel', //cancel
          handler: data => {
            //console.log('Voltar clicked');
          }
        },
        /*
        {
          text: 'Fazer Cadastro',
          handler: data => {
            this.navCtrl.push('LoginPage');
            
            if (this.User.isValid(data.username, data.password)) {
              // logged in!
            } else {
              // invalid login
              return false;
            }
          }
        } */

      ]
    });
    alert.present();
  } //Fim do presentPrompt  

  checkEmail(email) //Ita - 29/03/2018
  {
      var atpos = email.indexOf("@");
      var dotpos = email.lastIndexOf(".");
  
      if (atpos<1 || dotpos<atpos+2 || dotpos+2>=email.length) 
      {
          this.mailBad(email)
          return false;
      }
      return true;
  }//Fim do checkEmail

  mailBad(email) {
    
    let alert = this.alertCtrl.create({

      title: 'E-mail Inválido',
      message: 'A conta ' + email + ' está incorreta, por favor informe uma cona de e-mail correta',
      buttons: [
        {
          text: 'Ok',
          role: 'cancel', //cancel
          handler: data => {
            //console.log('Voltar clicked');
          }
        },
      ]
    });
    alert.present();
  } //Fim do mailBad

  downloadFile(patharq: string) {
    //console.log('Estou em downloadFile, pathfoto: ',patharq)

    this.filePath.resolveNativePath(patharq)
    .then((filePath) => {
      //console.log('downloadFile - Novo caminho do arquivo:',filePath)
      const fileTransfer: FileTransferObject = this.transfer.create();
      const url = filePath; //'http://www.example.com/file.pdf';
      fileTransfer.download(url, this.file.dataDirectory + 'fotoFB.jpg').then((entry) => {//fileTransfer.download(url, this.file.dataDirectory + 'file.pdf').then((entry) => {
        //console.log('download complete: ' + entry.toURL());
      }, (error) => {
        // handle error
        //console.log('Erro no fileTransfer.download, error: ',error)
      });
    }).catch(err => console.log('Erro do this.filePath.resolveNativePath: ',err));
   
  }  //Fim do downloadFile

  //Ita - 30/03/2018 - Seguindo orientação de http://docs.parseplatform.org/js/guide/#sessions para evitar error: 209-Inval session token.
  handleParseError(err) {
    switch (err.code) {
      case Parse.Error.INVALID_SESSION_TOKEN:
        Parse.User.logOut();
        alert('Por favor tente fazer o login novamente')
        //... // If web browser, render a log in screen
        //... // If Express.js, redirect the user to the log in route
        break;
  
      //... // Other Parse API errors that you want to explicitly handle
    }
  }
  /*
 getMenus(){
  console.log('Estou no getMenus')
  return this.http.get('../assets/data/menus.json').map((response:Response)=>response.json());
  } 
  */
 /**
  * Ita - 25/04/2018
  *     - getRoles()
  *     - Methodo para selecionar funções definidas na classe Roles(Função) do Parse Back4app.
  *     - As funções serem listadas para que o usuário possa visualizar e escolher seu perfil no 
  *     - App Controle de Bola. As funções de Administrador e Moderador não poderão ser escolhidas
  *     - pelo usuário e sim delegadas pelo Administrador - Primeiro Usuário a se cadastradar na
  *     - pelada.
  */
  getRoles(){

    //parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');//,parse.masterKey);
    //parse.serverURL = 'https://parseapi.back4app.com/';
    //console.log('Estou no getRoles()')
    var query = new Parse.Query(Parse.Role);
    query.find({
      success: function(dados) {
        // Do stuff
      }      
    }).then((datFuncoes)=>{
      //console.log('Estou no then datFuncoes: ',datFuncoes)

      for (var i = 0; i < datFuncoes.length; i++) {
        var objFuncoes = datFuncoes[i];
        var nameFunc = objFuncoes.get('name'),
            idFuncao = objFuncoes.id
          if (!(nameFunc == 'Administrador' || nameFunc == 'Moderador')) {
            this.userRoles.push( {
              "id": idFuncao,
            "name": nameFunc
          })
        }
      }
      //console.log('Carregou objeto userRoles: ',this.userRoles)
      //return this.userRoles;
  })
  } //Fim do getRoles

} //Fim da class ConfigProvider
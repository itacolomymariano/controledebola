import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { FacebookProvider } from '../../providers/facebook/facebook';
//import { Facebook } from '@ionic-native/facebook';
import { Facebook, FacebookLoginResponse } from '@ionic-native/facebook';
 
//Ita - 08/04/2018 - Permitir Download e Upload de Arquivos
//import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
//import { FilePath } from '@ionic-native/file-path';


// Parse Dependencies

import * as Parse from 'parse';
//import { SignUpCallback } from 'parse'; //Ita - 19/02/2018 - Possibilitar funções de login
import { Usuario } from './usuario.model';
import { objLogin } from './objLogin.model';
import { LoginPage } from '../login/login';
import { ConfigProvider } from '../../providers/config/config';
import { TabsPage } from '../tabs/tabs';
import { AlertController } from 'ionic-angular';
//import { EmailValidator } from '@angular/forms';

// To set the server URL
let parse = require('parse');

/**
 * Generated class for the AutenticacaoPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-autenticacao',
  templateUrl: 'autenticacao.html',
  providers: [ FacebookProvider,
               Facebook,
               ConfigProvider
   ]
})
export class AutenticacaoPage {
  
//  _llogin: boolean;
  /*
  public type = 'password';
  public showPass = false;
  */

  public dadoslogin = new Usuario();
  public nomeUsuario: string;
  public fcpathfoto: string;
  //private isAutenticUsu= false; //Ita - 24/03/2018 - Controlar Autenticação do Usuário
  //private dadosface = new Usuario();
  //public dadoslogin = new Usuario();
  //Ita - 23/03/2018 - public cb_username: any;
  
  //public fbAsyncInit: any; //Ita - 13/05/2018

  //salvarService: any;
  constructor(public navCtrl: NavController, 
              public navParams: NavParams,
              public facebookProvider: FacebookProvider,
              //public facebook: Facebook,
              public fb: Facebook,
              //public facebookloginresponse: FacebookLoginResponse,
              public configProvider: ConfigProvider,
              private alertCtrl: AlertController,
              private transfer: FileTransfer,
              private file: File
              //private filePath: FilePath
            //  private usuario: Usuario
            //  public salvarService: SalvarService
            ) {/*
              let aUsuDados = this.configProvider.getConfigDate();
              console.log('aUsuDados: ',aUsuDados)
              if(aUsuDados.nome != null){
                 let cb_username = aUsuDados.nome;
              }*/
  }

  ionViewDidEnter() {
    this.configProvider.type = 'password'; //Ita - 24/03/2018 - Mostrar/Ocultar senha nos forms de login.
    this.configProvider.showPass = false;
    //console.log('ionViewDidEnter AutenticacaoPage');

    //console.log('dadoslogin: ',this.dadoslogin);
    //    this.facebookProvider.loginFacebook();
    // Load the SDK asynchronously 
    this.loadSDK();    
  }
  
  //Função de simples login
  goSimpleLogin(cadastro: Usuario,iscallface: boolean){
    //console.log('Estou na Função goSimpleLogin - cadastro: ',cadastro)
    //let statslogin: boolean = null
    if (!cadastro.nome) {
      this.nameEmpty();
      return;
    }
    if (!cadastro.senha) {
      this.passEmpty();
      return;
    }    
    parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');//,parse.masterKey);
    parse.serverURL = 'https://parseapi.back4app.com/';
    Parse.User.logIn(cadastro.nome, cadastro.senha, {
      success: function(user) {
        // Do stuff after successful login.
        //console.log('Função Parse.User.logIn - Retornando user: ',user)
      },
      error: function(user, error) {
        // The login failed. Check error to see why.
        //alert("Error: " + error.code + " " + error.message);
  
      } //Fim do error - success: function(user)
    }).then((userLogado)=>{
        //console.log('Estou no then do Parse.User.logIn - userLogado: ',userLogado)// - iscallface: ',iscallface)
        //Parse.Session.current()
          
        var currentUser = Parse.User.current(); //Ita - 27/03/2018 - Verifica se o usuário está logado.
        if (currentUser) {
          // do stuff with the user
          
            let nomeUser =  currentUser.get("username")
            let contamail = currentUser.get("email") //Ita - 27/03/2018 - Recupera email cadsatrado pelo usuário
            let lAutorizado = currentUser.get("emailVerified") //Ita - 27/03/2018 - Verifica se o e-mail já foi confirmado pelo usuário
            //console.log('Verifico se Usuário está lAutorizado: ',lAutorizado)
            if(lAutorizado === true) {
              //console.log('Usuário Autorizado vou gravar config e ir para TabsPage nomeUser: ',nomeUser)
              this.configProvider.setConfigData(false, nomeUser, nomeUser,null,true,contamail);
              this.navCtrl.push(TabsPage);  //Ita - Será transferido para página inicial              
            } else {
              //console.log('Usuário NÃO Autorizado: ',lAutorizado)
              this.configProvider.presentPrompt(nomeUser,0,'E-mail não confirmado!','Atenção ' + nomeUser + ', foi enviado um e-mail para conta '+ contamail +' .Por favor abra sua caixa de mensagens e confirme seu cadastro para poder desfrutar o melhor de nosso App Controle de Bola!'); 
              Parse.User.logOut();
              this.navCtrl.push(AutenticacaoPage)
            };  //Ita - 26/03/2018 - Será transferido para página de Autenticacao

        } //Fim da Verificação if (currentUser)

    },(error)=>{
        if(error.code == 101){
        this.configProvider.presentPrompt(cadastro.nome,error.code,'Login Inválido','Usuário ' + cadastro.nome + ' não cadastrado ou senha incorreta! ' + ' Código do Erro [' + error.code + '] Se a senha que você digitou é a mesma do Facebook, então tente [ENTRAR COM FACEBOOK], caso contrário use [LEMBRAR MINHA SENHA]');
        } else {alert("Error: " + error.code + " " + error.message);}
    
    }//fim do (error)
  );//Fim do Parse.User.login

  }//Fim do goSimpleLogin

  goCadUsu(){
    //console.log('Estou na Função goCadUsu')
    this.navCtrl.push(LoginPage)
  }//Fim goCadUsu

  goforgotPas(){
    
    let alert = this.alertCtrl.create({

      title: 'Lembrar por E-mail',
      message: ' Por favor informe o e-mail que você cadastrou no App Controle de Bola para que possamos enviar uma mensagem e ajudá-lo a refazer sua senha',
      //cssClass: '', //Ita - 27/08/2018 - Definir propriedade de design da janela Alert
      
      
      inputs: [
        {
          name: 'email',
          placeholder: 'E-mail',
          type: 'email'
        }/*,
        {
          name: 'password',
          placeholder: 'Password',
          type: 'password'
        }*/
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: data => {
            //console.log('Voltar clicked');
          }
        },
        {
          text: 'Enviar',
          handler: data => {
            //console.log('Verificar o que poderá ser feito neste ponto! - data: ',data)
            if(this.configProvider.checkEmail(data.email)){
              if(typeof data.email!=null){
                this.goresetPass(data.email);
              }
            }
          } //Fim handler
        } 

      ]
    });
    alert.present();
  } //Fim do presentPrompt  

  goresetPass(email: string){
    //console.log('Estou em goresetPass, verificando email AGORA: ',email)
    parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');
    parse.serverURL = 'https://parseapi.back4app.com/';
    parse.User.requestPasswordReset(email, {
      success: function() {
      // Password reset request was sent successfully
      //console.log('E-mail para resetar senha foi enviado')
      },
      error: function(error) {
        // Show the error message somewhere
        console.log("Error: " + error.code + " " + error.message);
        /*
        console.log("Error no Email para resetar senha: " + error.code + " " + error.message)
        console.log('Email que não pôde receber mensagem de resetar senha: ',email)
        if(error.code == 205 || error.code == 209) { //Ita - 29/03/2019
          console.log('Entrei no if (error.code == 205 || error.code == 209): ',error.code)
          //this.mailnotExist(email);
          
        } else {
          console.log('else para exibir alert do error.code: ',error.code)
           alert("Error: " + error.code + " " + error.message);
        }
        */
      }
    }).then((data)=>{
      //console.log('Estou no then da parse.User.requestPasswordReset() data: ',data)
      this.mailSendyes(email);
    },(error)=>{
      //console.log('Estou no error do then da parse.User.requestPasswordReset() error: '+ error.code + " " + error.message)
      if(error.code == 205 || error.code == 209){
        this.mailnotExist(email);
      } else {alert("Error: " + error.code + " " + error.message);}
    });  //Ita - 29/03/2018 - Implementado then da parse.User.requestPasswordReset()
  } //Fim do goresetPass

  mailnotExist(email) {
    //console.log('estou no mailnotExist - email: ',email)
    let alert = this.alertCtrl.create({

      title: 'E-mail não existe!',
      message: 'A conta ' + email + ' está incorreta ou não existe no banco de dados do Controle de Bola. Não será possível enviar e-mail para refazer senha!',
      buttons: [
        {
          text: 'Ok',
          role: 'cancel', //cancel
          handler: data => {
            //console.log('Voltar clicked - E-mail não existe!');
          }
        },
      ]
    });
    alert.present();
  } //Fim do mailnotExist

  mailSendyes(email) {
    //console.log('estou no mailSendyes - email: ',email)
    let alert = this.alertCtrl.create({

      title: 'E-mail enviado!',
      message: 'Foi enviado e-mail para conta ' + email + ' Por favor abra sua caixa de mensagens, localize o e-mail do Controle de Bola e siga os procedimentos para refazer a senha e poder acessar novamente o nosso App!',
      buttons: [
        {
          text: 'Ok',
          role: 'cancel', //cancel
          handler: data => {
            //console.log('Voltar clicked - E-mail não existe!');
          }
        },
      ]
    });
    alert.present();
  } //Fim do mailSendyes

goConfCadFace(caddados: Usuario){ //Ita - 29/03/2018 - Confirmação do Cadastro Parse Back4App Após autenticação no Facebook

  //console.log('Estou em goConfCadFace: ')
  parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');
  parse.serverURL = 'https://parseapi.back4app.com/';
  var user = new Parse.User();
  user.set("username", caddados.nome);
  user.set("password", caddados.senha);
  user.set("email", caddados.email);
  //user.set("emailVerified",true)
  //console.log('Vou fazer signUp do goConfCadFace')
  user.signUp( {
    success: function(user) {
      console.log('cadastrei usuário pelo goConfCadFace')
    },
    error: function(user, error) {
      //alert("Error: " + error.code + " " + error.message);
      //console.log("Error goConfCadFace: " + error.code + " " + error.message);
    }
  }).then(()=>{
    //Ita - 27/03/2018 - Apresentar mensagem do envio do e-mail
    //console.log('estou por aqui, then SignUP do goConfCadFace')
    var currentUser = Parse.User.current(); //Ita - 27/03/2018 - Verifica se o usuário está logado.
    if (currentUser) {
        // do stuff with the user
        //console.log('currentUser do goConfCadFace: ',currentUser)
        //let lAutorizado = user.get("emailVerified") //Ita - 27/03/2018 - Verifica se o e-mail já foi confirmado pelo usuário
        //console.log('Verifico se Usuário está lAutorizado via goConfCadFace: ',lAutorizado)
        //if(lAutorizado === true) {
        //  console.log('Usuário está Autorizado: ',lAutorizado)
           //this.configProvider.setConfigData(false, caddados.nome, caddados.nome,null); 
           this.configProvider.setConfigData(false, caddados.nome, caddados.nome,caddados.foto);
           this.navCtrl.push(TabsPage);  //Ita - 26/03/2018 - Será transferido para página inicial
        //} else {
        //  console.log('Usuário NÃO Autorizado: ',lAutorizado)
          //Ita - 29/03/2018 - Usuário acabou de se cadastrar, não precisa desta mensagem neste momento - this.configProvider.presentPrompt(caddados.nome,0,'E-mail não confirmado!','Atenção ' + caddados.nome + ', foi enviado um e-mail para conta '+ caddados.email +' .Por favor abra sua caixa de mensagens e confirme seu cadastro para poder usar o App Controle de Bola!'); 
        //  this.navCtrl.push(AutenticacaoPage)};  //Ita - 26/03/2018 - Será transferido para página de Autenticacao
    } else {
        // show the signup or login page
        //console.log('currentUser false goConfCadFace: ',currentUser)
    } //Fim da Verificação if (currentUser)

  },(error)=>{
    //console.log('signUp do goConfCadFace- Provocou erro: ',error)
    if(error.code == 202 || error.code == 203) {

      Parse.User.logIn(caddados.nome, caddados.senha, {
        success: function(user) {
          // Do stuff after successful login.
          //console.log('Função Parse.User.logIn goConfCadFace - Retornando user: ',user)
        },
        error: function(user, error) {
          // The login failed. Check error to see why.
        } //Fim do error - success: function(user)
      }).then(()=>{
        //console.log('Estou no then do Parse.User.logIn chamado do error do SignUP no goConfCadFace')
        this.configProvider.setConfigData(false, caddados.nome, caddados.nome,caddados.foto);
        this.navCtrl.push(TabsPage);  //Ita - 26/03/2018 - Será transferido para página inicial        
      })

    } else {alert("Error: " + error.code + " " + error.message);}
  });//Fim do user.signUp

} //Fim do goConfCadFace

goLoginFace(){

  console.log('Executando método ... goLoginFace()')
  // Initialize Parse
  parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');
  parse.serverURL = 'https://parseapi.back4app.com/';

  parse.FacebookUtils.init({ // this line replaces FB.init({
    appId      : '802291219954371', // Facebook App ID
    //status     : false,  // check Facebook Login status
    cookie     : true,  // enable cookies to allow Parse to access the session
    xfbml      : true,  // initialize Facebook social plugins on the page
    version    : 'v2.12' //'v2.7'//'v2.3' // point to the latest Facebook Graph API version
  });
    console.log('Após FacebookUtils.init ...')
      parse.FacebookUtils.logIn('public_profile,email', {
        success: function(user) {
          console.log('Estou no success do parse.FacebookUtils.logIn, user: ',user)
          if (!user.existed()) {
            console.log("User signed up and logged in through Facebook!, user: ",user)
          } else {
            console.log("User logged in through Facebook!, user:", user)
          }
        }      
      }).then((usuarioFB)=>{
        console.log('Cheguei aki');
        let params = new Array<string>();
        console.log('then do FacebookUtils.login - usuarioFB: ',usuarioFB)
        //Ita - 14/05/2018 - this.facebook.api('/me?fields=name,email,gender,locale,picture,age_range,id', params).then(perfilFB => {
          this.fb.api('/me?fields=name,email,gender,locale,picture,age_range,id', params).then(perfilFB => {
          console.log('Perfil do usuário no Facebook: ',perfilFB)
          var query = new Parse.Query(Parse.User);
          query.equalTo("email", perfilFB.email);  // procura usuário pelo e-mail
          query.find({
            success: function(dadosUsuario) {
              // Do stuff
            }      
          }).then((userFound)=>{
            console.log('retorno da query - Back4app - userFound: ',userFound)
            for (var i = 0; i < userFound.length; i++) {
              var objUserFound = userFound[i];
              var nameFound = objUserFound.get('username')
            }
            console.log('Vou verificar se devo exibir a mensagem de duplicidade')
            var currentUser = Parse.User.current();
            var lPergUserDup = currentUser.get('alertuserdup')
            console.log('A mensagem de Duplicidade deve ser apresentada? ',lPergUserDup)          
            if (!(lPergUserDup === false)) {
              this.alertUserFound(nameFound,0,'Usuário Duplicado','Atenção '+nameFound+' Localizamos em nossa base um outro cadastro com o mesmo e-mail de seu perfil facebook: '+perfilFB.email+' Click em Sair para fazer Login com Usuário e Senha, ou Click em continuar se preferir controlar seus dados por este perfil do facebook. Lembramos que sua experiência no Controle de Bola será muito melhor se você manter apenas um único cadastro.',lPergUserDup);
            }

            
            //var currentUser = Parse.User.current();
            if (currentUser) {
              //var data = user.get('authData').facebook;
              if (!(nameFound == perfilFB.name)) {
                currentUser.set("username",perfilFB.name)
                //currentUser.set("email",perfilFB.email)
                currentUser.save()
              }
              console.log('vou mudar de página - this.navCtrl.push(TabsPage) ')
              //this.downloadFotoFB(perfilFB.picture.data.url); //Ita - 08/04/2018 - Faz download da foto do perfil facebook
              //this.configProvider.downloadFile(perfilFB.picture.data.url); //Ita - 09/04/2018 - Faz download de arquivos
              this.configProvider.setConfigData(false, perfilFB.name, perfilFB.name,perfilFB.picture.data.url,null,perfilFB.email);
              this.navCtrl.push(TabsPage);                                
            } 

          })//Fim do then query.find - userFound

            }, (error) => {
              alert(error);
              console.log('Erro do this.facebook.api error: ',error);
              }
        )
      },(error)=>{
        console.log('Erro do FacebookUtils.login',error)
      }).then((erroFbLogin)=>{console.log('Peguei erro aqui: ',erroFbLogin)}) //Fim do then do FacebookUtils
      
} //Fim do goLoginFace
  
  downloadFotoFB(pathfoto: string) {
    //console.log('Estou em downloadFotoFB, pathfoto: ',pathfoto)
    const fileTransfer: FileTransferObject = this.transfer.create();
    const url = pathfoto; //'http://www.example.com/file.pdf';
    fileTransfer.download(url, this.file.dataDirectory + 'fotoFB.jpg').then((entry) => {//fileTransfer.download(url, this.file.dataDirectory + 'file.pdf').then((entry) => {
      //console.log('download complete: ' + entry.toURL());
    }, (error) => {
      // handle error
      //console.log('Erro no fileTransfer.download, error: ',error)
    });
  }  //Fim do downloadFotoFB

  alertUserFound(nomeusu: string,coderro,tit_alert:any,msg_alert:any,lshowMsg: boolean = true) {
    
    let alert = this.alertCtrl.create({

      title: tit_alert, //'Login Inválido',
      message: msg_alert, //'Usuário ' + nomeusu + ' não cadastrado ou senha incorreta! ' + ' Código do Erro [' + coderro + ']',
      //cssClass: '', //Ita - 27/08/2018 - Definir propriedade de design da janela Alert
      
      /*
      inputs: [
        {
          name: 'Exibir',
          type: 'checked',
          checked: lshowMsg,
          label: 'Não mostre novamente',
          handler: data => {
            console.log('Estado do Exibir: ',data.checked);
            if (!data.checked) {
              var currentUser = Parse.User.current();
              currentUser.set("alertuserdup",false)
              currentUser.save()
            }
          }
        }
        ,
        {
          name: 'password',
          placeholder: 'Password',
          type: 'password'
        }
      ],*/
      buttons: [
        {
          text: 'Sair',
          role: 'cancel', //cancel
          handler: data => {
            //console.log('Sair clicked');
            Parse.User.logOut();

            this.navCtrl.push(AutenticacaoPage);
          }
        },
        {
          text: 'Continuar',
          role: 'cancel',
          handler: data => {
            //console.log('Continuar Clicked: ');
            var currentUser = Parse.User.current();
            currentUser.set("alertuserdup",false)
            currentUser.save()
          }
        } 

      ]
    });
    alert.present();
  } //Fim do alertUserFound

nameEmpty() {
  //console.log('estou no mailnotExist - email: ',email)
  let alert = this.alertCtrl.create({

    title: 'Usuário em branco!',
    message: 'Informe um usuário para entrar o Controle de Bola!',
    buttons: [
      {
        text: 'Ok',
        role: 'cancel', //cancel
        handler: data => {
          //console.log('Voltar clicked - E-mail não existe!');
        }
      },
    ]
  });
  alert.present();
} //Fim do mailnotExist

passEmpty() {
  //console.log('estou no mailnotExist - email: ',email)
  let alert = this.alertCtrl.create({

    title: 'Senha em branco!',
    message: 'Digite a senha para entrar no Controle de Bola!',
    buttons: [
      {
        text: 'Ok',
        role: 'cancel', //cancel
        handler: data => {
          //console.log('Voltar clicked - E-mail não existe!');
        }
      },
    ]
  });
  alert.present();
} //Fim do mailnotExist

loadSDK() {
  (function(d, s, id){
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement(s); js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
}

goFaceLogin(){

  console.log('Executando método ... goFaceLogin()')
  // Initialize Parse
  parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');
  parse.serverURL = 'https://parseapi.back4app.com/';

  parse.FacebookUtils.init({ // this line replaces FB.init({
    appId      : '802291219954371', // Facebook App ID
    //status     : false,  // check Facebook Login status
    cookie     : true,  // enable cookies to allow Parse to access the session
    xfbml      : true,  // initialize Facebook social plugins on the page
    version    : 'v2.12' //'v2.7'//'v2.3' // point to the latest Facebook Graph API version
  });
    console.log('Após FacebookUtils.init ... ')
      
  let permissions = new Array<string>();
  permissions = ["public_profile", 
                    "email"
                ];   
  /*
  let lgnOpt: objLogin = {
    enable_profile_selector: true,
    return_scopes: true,
    scope: 'email,public_profile',//'user_birthday,user_photos,email,public_profile',
    auth_type: 'rerequest'
  } 
  let loginOptions = JSON.stringify(lgnOpt);
  */
  //this.fb.login(permissions), {
    //this.fb.login(permissions).then((resfblogin)=>{
      console.log('Vou verificar o Status da Conexão com Facebook, chamando getLoginStatus() ....')
      this.fb.getLoginStatus().then((resfbstatus)=>{
        //success: function(user) {
          //if (!user.existed()) {
          //  console.log("this.fb.login - Usuário não existe!, user: ",user)
          //} else {
          //  console.log("this.fb.login - Usuário não existe!, user:", user)
          console.log('Estou no then do getLoginStatus() ... resfbstatus: ',resfbstatus)
        //if (resfbstatus.status === 'connected') {
            console.log('Usuário está conectado no facebook!')
            this.fb.login(permissions).then((resfblogin)=>{
              console.log('fb.login - Cheguei aki - resfblogin: ',resfblogin);
              let params = new Array<string>();
              //Ita - 14/05/2018 - this.facebook.api('/me?fields=name,email,gender,locale,picture,age_range,id', params).then(perfilFB => {
              this.fb.api('/me?fields=name,email,gender,locale,picture,age_range,id', params).then(perfilFB => {
                console.log('Perfil do usuário no Facebook: ',perfilFB)
                var query = new Parse.Query(Parse.User);
                query.equalTo("email", perfilFB.email);  // procura usuário pelo e-mail
                query.find({
                  success: function(dadosUsuario) {
                    // Do stuff
                  }      
                }).then((userFound)=>{
                  console.log('then da query no Back4app - userFound: ',userFound)
                  for (var i = 0; i < userFound.length; i++) {
                    var objUserFound = userFound[i];
                    var nameFound = objUserFound.get('username')
                  }
                  console.log('Vou verificar se devo exibir a mensagem de duplicidade')
                  var currentUser = Parse.User.current();
                  var lPergUserDup = currentUser.get('alertuserdup')
                  console.log('A mensagem de Duplicidade deve ser apresentada? ',lPergUserDup)          
                  if (!(lPergUserDup === false)) {
                    this.alertUserFound(nameFound,0,'Usuário Duplicado','Atenção '+nameFound+' Localizamos em nossa base um outro cadastro com o mesmo e-mail de seu perfil facebook: '+perfilFB.email+' Click em Sair para fazer Login com Usuário e Senha, ou Click em continuar se preferir controlar seus dados por este perfil do facebook. Lembramos que sua experiência no Controle de Bola será muito melhor se você manter apenas um único cadastro.',lPergUserDup);
                  }
                    
                  //var currentUser = Parse.User.current();
                  if (currentUser) {
                    //var data = user.get('authData').facebook;
                    if (!(nameFound == perfilFB.name)) {
                      currentUser.set("username",perfilFB.name)
                      //currentUser.set("email",perfilFB.email)
                      currentUser.save()
                    }
                    console.log('Vou mudar de página - this.navCtrl.push(TabsPage)')
                    //this.downloadFotoFB(perfilFB.picture.data.url); //Ita - 08/04/2018 - Faz download da foto do perfil facebook
                    //this.configProvider.downloadFile(perfilFB.picture.data.url); //Ita - 09/04/2018 - Faz download de arquivos
                    this.configProvider.setConfigData(false, perfilFB.name, perfilFB.name,perfilFB.picture.data.url,null,perfilFB.email);
                    this.navCtrl.push(TabsPage);                                
                  } 
      
                })//Fim do then query.find - userFound
      
                  }, (error) => {
                    alert(error);
                    console.log('Erro do this.facebook.api error: ',error);
                    }
              ) //Fim do then do this.fb.api()
            }) //Fim do this.fb.login
        /*} else {
            // usuário desconectado do Facebook
            this.fbDesconect();
        }*/
      
          //} //Fim do if (!user.existed())
    //} //Fim do success: function(user) {
  }) //Fim do this.fb.login(permissions)
    //}) //Fim do FacebookUtils.init
} //Fim do goFaceLogin

fbDesconect() {
  //console.log('estou no mailnotExist - email: ',email)
  let alert = this.alertCtrl.create({

    title: 'Facebook Desconectado!',
    message: 'Conecte no Facebook para depois usar esta opção de login!',
    buttons: [
      {
        text: 'Ok',
        role: 'cancel', //cancel
        handler: data => {
          //console.log('Voltar clicked - E-mail não existe!');
        }
      },
    ]
  });
  alert.present();
} //Fim do mailnotExist

} //export class AutenticacaoPage

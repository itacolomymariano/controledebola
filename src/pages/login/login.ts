import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Usuario } from '../autenticacao/usuario.model';
import { ConfigProvider } from '../../providers/config/config';
import { TabsPage } from '../tabs/tabs';

import * as Parse from 'parse';
import { AutenticacaoPage } from '../autenticacao/autenticacao';
//import { Token } from '@angular/compiler';
let parse = require('parse');

/**
 * Generated class for the LoginPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-login',
  templateUrl: 'login.html',
  providers: [
    ConfigProvider
  ]
})
export class LoginPage {
  public caddados = new Usuario();
  //public cb_username: any;
  constructor(public navCtrl: NavController, 
              public navParams: NavParams,
              private configProvider: ConfigProvider/*,
              private autenticacaoPage: AutenticacaoPage,
              private usuario: Usuario,
              private configProvider: ConfigProvider*/

            ) {

  }//Fim do constructor

  ionViewDidEnter() {
    this.configProvider.type = 'password'; //Ita - 24/03/2018 - Mostrar/Ocultar senha nos forms de login.
    this.configProvider.showPass = false;
    //console.log('ionViewDidLoad LoginPage');
    //this.configProvider.cb_username; //Ita - 21/03/2018 - Apresentar nome do usuário em todas as páginas do app.
  }//Fim do ionViewDidLoad()

  goConfirmCad(caddados: Usuario){
    //console.log('Estou em goConfirmCad para validar informações antes de efetivar o cadastro: ')
    if(this.configProvider.checkEmail(caddados.email) == false){//Ita - 29/03/2018
      return
    }
    /******************
     * Ita - 11/04/2018
     * Verifica a confirmação do e-mail e da senha antes de efetivar o cadastro
     ***************************************************************************/

    if(caddados.nome == null) {
      this.configProvider.presentPrompt(caddados.nome,0,'Usuário não informado!','Atenção! O nome do usuário é primordial para usar o Controle de Bola, por favor defina um nome de sua preferência e confirme seu cadastro para poder desfrutar o máximo de nosso App'); 
      return
    }
     if(caddados.email == null) {
      this.configProvider.presentPrompt(caddados.nome,0,'E-mail não informado!','Atenção ' + caddados.nome + ', O e-mail será utilizado para confirmar seu cadastro, portando informe uma conta de e-mail válida para que seu cadastro possa ser confirmado!'); 
      return      
    }

    if(caddados.confemail == null) {
      this.configProvider.presentPrompt(caddados.nome,0,'E-mail não confirmado!','Atenção ' + caddados.nome + ', Por favor confirme seu e-mail, para garantir que você receberá nossa mensagem de confirmação de cadastro para poder desfrutar o melhor de nosso App!'); 
      return      
    }    

    if((caddados.email) != (caddados.confemail)) {
      this.configProvider.presentPrompt(caddados.nome,0,'E-mails diferentes!','Atenção ' + caddados.nome + ', O e-mail ' + caddados.email + ' não confere com a confirmação do e-mail ' + caddados.confemail + ' Favor informar o mesmo e-mail nos dois campos'); 
      return      
    }

    if(caddados.senha == null) {
      this.configProvider.presentPrompt(caddados.nome,0,'Senha não informada!','Atenção ' + caddados.nome + ', O uso da senha é obrigatório para entrar no Controle de Bola, por favor defina uma senha para desfrutar o melhor de nosso App!'); 
      return      
    }

    if(caddados.confirmsenha == null) {
      this.configProvider.presentPrompt(caddados.nome,0,'Senha não confirmada!','Atenção ' + caddados.nome + ', Por favor confirme sua senha para garantir uma melhor experiência no uso de nosso App'); 
      return      
    }    

    if((caddados.senha) != (caddados.confirmsenha)) {
      this.configProvider.presentPrompt(caddados.nome,0,'Senhas diferentes!','Atenção ' + caddados.nome + ', A senha informada é diferente da confirmção da senha. Por favor informe a mesma senha para os dois campos e confirme seu cadastro para desfrutar o melhor de nosso App.'); 
      return      
    }

    //Ita - 03/07/2017 - Inicializar PARSE SDK - Primeiro Parâmetro('APPLICATION_ID'), Segundo Parâmetro (JAVASCRIPT_KEY')
    parse.initialize('JNgmvYsPzyLmsEKkD0ZD0PRl4zMn9OySUyhLtBgk', '8KnnmWFuSz1LZX4kaEL60PrO7QhEazNxe2KRe75n');
    parse.serverURL = 'https://parseapi.back4app.com/';
    var user = new Parse.User();
    user.set("username", caddados.nome);
    user.set("password", caddados.senha);
    user.set("email", caddados.email);    
    //console.log('Vou fazer signUp')
    //Parse.User.logOut();//Ita - 30/03/2018  
    Parse.User.logOut();//Ita - 30/03/2018  
    user.signUp( {
      success: function(user) {
        //console.log('cadastrei usuário')
      },
      error: function(user, error) {
        //alert("Error: " + error.code + " " + error.message);
        //console.log("Error: " + error.code + " " + error.message);
      }
    }).then(()=>{
      //Ita - 27/03/2018 - Apresentar mensagem do envio do e-mail
      //console.log('estou por aqui - then do signUp')
      //this.configProvider.presentPrompt(caddados.nome,0,'E-mail enviado','Atenção ' + caddados.nome + ', foi enviado um e-mail para conta '+ caddados.email +' .Por favor abra sua caixa de mensagens e confirme seu cadastro para poder usar o App Controle de Bola!'); 
      var currentUser = Parse.User.current(); //Ita - 27/03/2018 - Verifica se o usuário está logado.
      
      if (currentUser) {
          // do stuff with the user
          //console.log('Usuário conectado no Controle de Bola: ',currentUser)

          let lAutorizado = user.get("emailVerified") //Ita - 27/03/2018 - Verifica se o e-mail já foi confirmado pelo usuário
          //console.log('Verifico se Usuário está lAutorizado: ',lAutorizado)
          if(lAutorizado === true) {
            //console.log('Usuário está Autorizado: ',lAutorizado)
            
            this.configProvider.setConfigData(false, caddados.nome, caddados.nome,null); 
            this.navCtrl.push(TabsPage);  //Ita - 26/03/2018 - Será transferido para página inicial
            
          } else {
            //console.log('Usuário NÃO Autorizado: ',lAutorizado)
            //Ita - 29/03/2018 - Usuário acabou de se cadastrar, não precisa desta mensagem neste momento - this.configProvider.presentPrompt(caddados.nome,0,'E-mail não confirmado!','Atenção ' + caddados.nome + ', foi enviado um e-mail para conta '+ caddados.email +' .Por favor abra sua caixa de mensagens e confirme seu cadastro para poder usar o App Controle de Bola!'); 
            this.configProvider.presentPrompt(caddados.nome,0,'E-mail enviado','Atenção ' + caddados.nome + ', foi enviado um e-mail para conta '+ caddados.email +' .Por favor abra sua caixa de mensagens e confirme seu cadastro para poder desfrutar sua melhor experiência em nosso App Controle de Bola!'); 
            parse.User.logOut();//Ita - 10/04/2018 - Força logoOut  da sessão criada pelo signUp
            this.navCtrl.push(AutenticacaoPage)};  //Ita - 26/03/2018 - Será transferido para página de Autenticacao

      } else {
          // show the signup or login page
          //console.log('Usuário não conseguiu logar no Controle de Bola: ',currentUser)
      } //Fim da Verificação if (currentUser)

    },(error)=>{
      //console.log('signUp - Provocou erro: ',error)
      if(error.code == 202 || error.code == 203) {
        if(error.code == 202) {
           this.configProvider.presentPrompt(caddados.nome,error.code,'Cadastro Inválido','Usuário ' + caddados.nome + ' já existe no Controle de Bola. Código do Erro: ['+ error.code +']');
        } else {
          this.configProvider.presentPrompt(caddados.nome,error.code,'Cadastro Inválido','E-mail ' + caddados.email + ' já existe no Controle de Bola. Código do Erro: ['+ error.code +']');
        }
      } else {alert("Error: " + error.code + " " + error.message);}
    });//Fim do user.signUp

  } //Fim do goConfirm
  
}//Fim da class LoginPage
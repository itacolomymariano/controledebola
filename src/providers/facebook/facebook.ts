import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Facebook } from '@ionic-native/facebook';
//import { Usuario, SalvarService } from '../../pages/autenticacao/autenticacao.module';
//import { Usuario } from '../../pages/autenticacao/autenticacao.module';

//import { Usuario } from './autenticacao.module';
/*
  Generated class for the FacebookProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class FacebookProvider {

/*  static loginFaceook(): any {
    throw new Error("Method not implemented.");
  }*/
  constructor(public http: HttpClient,
              public facebook: Facebook,
              //public usuario: Usuario//,
              //public salvarService: SalvarService
  ) {
    console.log('Hello FacebookProvider Provider');
  }

  //método para chamar api do facebook e salvar no banco o usuario    
/*
loginFacebook() {
  console.log('Cheguei aqui...loginFacebook')
  let permissions = new Array<string>();
  permissions = ["public_profile", "email"];
  
  this.facebook.login(permissions).then((response) => {
     let params = new Array<string>();
     this.facebook.api("/me?fields=name,email", params).then(res => {
           //estou usando o model para criar os usuarios
           let usuario = new Usuario();
           usuario.nome = res.name;
           usuario.email = res.email;
           usuario.senha = res.id;
           usuario.login = res.email;
           this.logar(usuario);
         }, (error) => {
           alert(error);
           console.log('ERRO LOGIN: ',error);
           }
     )
 }, (error) => {
   alert(error);
 });

}

logar(usuario: Usuario) {
  let cteste = this.salvarService.salvarFacebook(usuario);
  console.log(cteste)
 }
*/
}
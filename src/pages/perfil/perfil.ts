//import { Component,Pipe } from '@angular/core';
import { Component } from '@angular/core';
//import { IonicPage, NavController, NavParams, DateTime } from 'ionic-angular';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Usuario } from '../autenticacao/usuario.model';
import { Pessoa } from './pessoa.model'
import { ConfigProvider } from '../../providers/config/config';
//import { DatePicker } from '@ionic-native/date-picker';
//import {NgxMaskModule} from 'ngx-mask'
//import { InputMaskModule } from 'ionic-input-mask';
//import { CbmaskgenDirective } from '../../directives/cbmaskgen/cbmaskgen';
import { CurrencyPipe } from '@angular/common';
import { BrMaskerModule } from 'brmasker-ionic-3';
import {TextMaskModule} from 'angular2-text-mask';

// Parse Dependencies
import * as Parse from 'parse';
import { TabsPage } from '../tabs/tabs';
//import { dateDataSortValue } from 'ionic-angular/util/datetime-util';
// To set the server URL
//let parse = require('parse');

/**
 * Generated class for the PerfilPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-perfil',
  templateUrl: 'perfil.html',
})
export class PerfilPage {
  public nomeUsuario: string;
  public fcpathfoto: string;
  public person = new Pessoa();
  public emailUsuario: string;
  public myAge: number;
  public tammaskphone   = 15
  public phonemask = '(99) 99999-9999'
  public listRoles: any;

  constructor(public navCtrl: NavController, 
              public navParams: NavParams,
              public configProvider: ConfigProvider,
              public currencyPipe: CurrencyPipe,
              public brmasker: BrMaskerModule,
              public testMaskModule: TextMaskModule
              //public cbmaskgenDirective: CbmaskgenDirective
              //private datePicker: DatePicker
              //public pessoa: Pessoa
  ) {
      this.nomeUsuario = JSON.parse(localStorage.getItem('config')).username;
      this.fcpathfoto = JSON.parse(localStorage.getItem('config')).fbfoto;
      this.emailUsuario = JSON.parse(localStorage.getItem('config')).email;
   
  }

  //ionViewDidLoad() {
    ionViewDidEnter() {
    //console.log('ionViewDidEnter PerfilPage');
    var usuForm = Parse.User.current(),
        alturaForm = usuForm.get('height'),
        pesoForm   = usuForm.get('weight'),
        chutForm   = usuForm.get('shoes'),
        foneForm   = usuForm.get('phone'),
        perfForm   = usuForm.get('profile') 
    if (alturaForm == null) {
      alturaForm = '';
    }
    if (pesoForm == null) {
      pesoForm = '';
    }
    if (perfForm == null) {
      perfForm = '';
    }
    if (usuForm) {
        var dtNasc = usuForm.get('birthdate');
        this.calcAge(dtNasc);
        //console.log('dtNasc: ',dtNasc)
        var dtnewNasc = dtNasc.toJSON();
        //console.log('Novo dtNasc: ',dtnewNasc)
        this.person = {
                "id": usuForm.id,
              "nome": usuForm.get('username'),
              "email": usuForm.get('email'),
              "senha": '',
              "dtaniversario": dtnewNasc, //dtNasc, //
              "foto": '',
              "idade": this.myAge,
              "altura": alturaForm,
              "peso": pesoForm,
              "chuteira": chutForm,
              "fone": this.formatField(foneForm, this.phonemask, this.tammaskphone),
              //"idfunc": perfForm,
              "nmfunc": perfForm //this.getRoleName(perfForm)
        }
        console.log('Após carga do this.person: ',this.person)
    }

    //this.listRoles = this.configProvider.getRoles();//Carrega o Objeto de Funções
    //console.log('Preparando PerfilPage - listRoles: ',this.listRoles)
    this.configProvider.getRoles();//Carrega o Objeto de Funções
    //console.log('Preparando PerfilPage - this.userRoles: ',this.configProvider.userRoles)

  }//Fim do ionViewDidEnter()

  savePerson(person: Pessoa){
    console.log('Estou no savePerson - person: ',person)
    console.log('savePerson - person.nmfunc: ',person.nmfunc) //id da Role
    var dadosPessoa = Parse.User.current()
    //roleName = this.getRoleName(person.nmfunc); //Obtem nome da Role passando como parametro o id da Role, que neste momento foi gravado na variável person.nmfunc
    //console.log('roleName: ',roleName)
    var roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo("name", person.nmfunc);
    roleQuery.first().then(function(role) {
      //roleQuery.find().then(function(role) {
      console.log('Estou aqui no then da roleQuery: ',role)
      role.getUsers().add(dadosPessoa);
      // save role
      console.log('Vou salvar classe role - role.save(null, { useMasterKey: true }) ... ')
      role.save().then((savRole)=>{                  //Ita - 27/04/2018 - Retirado null, { useMasterKey: true } do interior da função save()
        console.log('Salvei - Atribuído Função do usuário: ',savRole)
      },errSvRole=>{
        console.log('Ocorreu erro ao tentar salvar Função na classe Role - error: ',errSvRole)
      });
      //var relation = role.relation("users");
      //relation.add(dadosPessoa);
      //role.save(null, { useMasterKey: true });
    });
 
        //var Message = Parse.Object.extend("Message");
        //var groupMessage = new Message();
        //roleACL = new Parse.ACL(),

        //Classe.setACL(roleACL);
        //Classe.save();
        //usersToAddToRole = { number: dadosPessoa.id, string: dadosPessoa.get("username") }
        //var rolesToAddToRole = '';

    //Implementa usuário a função escolhida na página de perfil.
    //roleACL.setReadAccess(dadosPessoa, true);
    //roleACL.setWriteAccess(dadosPessoa, true);
    //var role = new Parse.Role(roleName, roleACL);
    //role.getUsers().add(dadosPessoa);
    //role.getRoles().add(rolesToAddToRole);
    //role.save()/*null,{}).then((retsaveRole)=>{
      //console.log('Estou no then para salvar Role(Função) - retsaveRole: ',retsaveRole)
    //});
    
    //var userPointer = Parse.User.createWithoutData(dadosPessoa.id) ;

    dadosPessoa.set("birthdate",new Date(person.dtaniversario))
    dadosPessoa.set("height", Number(person.altura) )
    dadosPessoa.set("weight", Number(person.peso))
    dadosPessoa.set("shoes", Number(person.chuteira))
    dadosPessoa.set("phone", this.clearString(person.fone.toString(), "0123456789"))
    dadosPessoa.set("profile", person.nmfunc)
    dadosPessoa.save(null,{
      }).then((retSave)=>{
        this.configProvider.presentPrompt(person.nome,0,'Perfil Atualizado!','Os dados de seu Perfil foram atualizados com sucesso!'); 
        //this.navCtrl.push(PerfilPage);
    })

  } //Fim do savePerson()

  fecharSP(){
    //console.log('Estou no fecharSP()')
    this.navCtrl.push(TabsPage);
  }  
  /*
  getCurrency(amount: number) {
    console.log('Estou aqui no getCurrency - amount: ',amount)
    return this.currencyPipe.transform(amount, 'EUR', true, '1.2-2');
  }
  */

//////////////////////////////////////
/// Ita - 15/04/2018
///       Methodo para calcular idade
calcAge(dtNasc: Date) {
  if (dtNasc == null) {
    dtNasc = new Date()
  }
  var todayDate = new Date(),
      todayYear = todayDate.getFullYear(),
      todayMonth = todayDate.getMonth(),
      todayDay = todayDate.getDate(),
      birthYear = dtNasc.getFullYear(),
      birthMonth= dtNasc.getMonth(),
      birthDay  = dtNasc.getDate(),
      age = todayYear - birthYear;
       
      if (todayMonth < birthMonth - 1) {
        age--;
      }

      if (birthMonth - 1 === todayMonth && todayDay < birthDay) {
        age--;
      }
      this.myAge = age;

    } //Fim da calcAge

    //updateList(ev){
    //Ita - 22/04/2018 - Formata o valor digitado no campo.
    formatDigit(ev,opcCall: number) {

        //this.person.altura = this.currencyFormatted(ev.target.value)
        //console.log('Estou em formatDigit - ev: ',ev)
        //console.log('Estou em formatDigit - opcCall: ',opcCall)
        if (opcCall == 1) {
            this.person.altura = this.formatHeight(ev.target.value)
        }

        if (opcCall == 2) {
          this.person.peso = this.formatWeight(ev.target.value)
        }

        if (opcCall == 3) {
          this.person.chuteira = this.formatShoes(ev.target.value)
        }
        

        if (opcCall == 4) {
          this.person.fone = this.formatPhone(ev.target.value)
        }

      } //Fim do formatDigit

      //Altura
      formatHeight(varHeight) {
        var formatedValue = varHeight;
        var real = '';
        var cents = '';
        var temp = [];
        var i = 0;
        var j = 0;
        var k = 0;
      console.log('Estou em formatHeight - formatedValue: ',formatedValue)
        formatedValue = this.clearString(formatedValue.toString(), "0123456789");
        //console.log('formatedValue após clearString: ',formatedValue)
        /*if(formatedValue.length > 3){
          return
        }*/

        if(formatedValue.length > 2) {
      
          real = formatedValue.substr(0, formatedValue.length - 2);
          real = "" + parseInt(real, 10);
          cents = formatedValue.substr(formatedValue.length - 2, 2);
          //console.log('formatHeight[Altura] - real: ',real)
          //console.log('formatHeight[Altura] - cents: ',cents)
          if(real.length > 2) {
            temp = [];
            for(i = real.length - 1, j = 1, k = 0; i > 0 ; i--, j++) {
              if((j % 2) == 0) {
                temp.push(real.substr(i, 2));
                k++;
              }
            }
            temp.reverse();
            //real = real.substr(0, real.length - (2 * k)) + '.' + temp.join('.');
            real = real.substr(0, real.length - (2 * k)) + ',' + temp.join(',');
          }
          //formatedValue = real + ',' + cents;
          formatedValue = real + '.' + cents;
        }
        //console.log('return formatedValue Altura: ',formatedValue)
        return formatedValue;
      } //Fim do formatHeight - Formatação da Altura

      //Peso
      formatWeight(varWeight) {
        var formatedValue = varWeight;
        var real = '';
        var cents = '';
        var temp = [];
        var i = 0;
        var j = 0;
        var k = 0;
        //console.log('Estou em formatWeight - formatedValue: ',formatedValue)
        formatedValue = this.clearString(formatedValue.toString(), "0123456789");
        //console.log('formatWeight - formatedValue após clearString: ',formatedValue)
      
        if(formatedValue.length > 3) {
      
          real = formatedValue.substr(0, formatedValue.length - 3);
          real = "" + parseInt(real, 10);
          cents = formatedValue.substr(formatedValue.length - 3, 3);
          //console.log('formatWeight[Peso] - real: ',real)
          //console.log('formatWeight[Peso] - cents: ',cents)
          if(real.length > 3) {
            temp = [];
            for(i = real.length - 1, j = 1, k = 0; i > 0 ; i--, j++) {
              if((j % 3) == 0) {
                temp.push(real.substr(i, 3));
                k++;
              }
            }
            temp.reverse();
            //real = real.substr(0, real.length - (3 * k)) + '.' + temp.join('.');
            real = real.substr(0, real.length - (3 * k)) + ',' + temp.join(',');
          }
          //formatedValue = real + ',' + cents;
          formatedValue = real + '.' + cents;
        }
        //console.log('return formatedValue Peso: ',formatedValue)
        return formatedValue;        
      } //Fim do formatWeight - Formatação do Peso

      //Moeda
      currencyFormatted(amount) {
      
        var formatedValue = amount;
        var real = '';
        var cents = '';
        var temp = [];
        var i = 0;
        var j = 0;
        var k = 0;
      
        formatedValue = this.clearString(formatedValue.toString(), "0123456789");
      
        if(formatedValue.length > 3) {
      
          real = formatedValue.substr(0, formatedValue.length - 3);
          real = "" + parseInt(real, 10);
          cents = formatedValue.substr(formatedValue.length - 3, 3);
      
          if(real.length > 3) {
            temp = [];
            for(i = real.length - 1, j = 1, k = 0; i > 0 ; i--, j++) {
              if((j % 3) == 0) {
                temp.push(real.substr(i, 3));
                k++;
              }
            }
            temp.reverse();
            real = real.substr(0, real.length - (3 * k)) + '.' + temp.join('.');
          }
          formatedValue = real + ',' + cents;
        }
        return formatedValue;
      } //Fim do currencyFormatted - Formatação da Moeda
      
      //Chuteira
      formatShoes(varShoes) {
        var formatedValue = varShoes;
        var real = '';
        var cents = '';
        var temp = [];
        var i = 0;
        var j = 0;
        var k = 0;
      //console.log('Estou em formatShoes - formatedValue: ',formatedValue)
        formatedValue = this.clearString(formatedValue.toString(), "0123456789");
        //console.log('Shoes - formatedValue após clearString: ',formatedValue)
        /*if(formatedValue.length > 3){
          return
        }*/

        if(formatedValue.length > 2) {
      
          real = formatedValue.substr(0, formatedValue.length - 2);
          real = "" + parseInt(real, 10);
          cents = formatedValue.substr(formatedValue.length - 2, 2);
          //console.log('formatShoes[Chuteira] - real: ',real)
          //console.log('formatShoes[Chuteira] - cents: ',cents)
          if(real.length > 2) {
            temp = [];
            for(i = real.length - 1, j = 1, k = 0; i > 0 ; i--, j++) {
              if((j % 2) == 0) {
                temp.push(real.substr(i, 2));
                k++;
              }
            }
            temp.reverse();
            //real = real.substr(0, real.length - (2 * k)) + '.' + temp.join('.');
            real = real.substr(0, real.length - (2 * k)) //+ ',' + temp.join(',');
          }
          //formatedValue = real + ',' + cents;
          //formatedValue = real + '.' + cents;
          formatedValue = real;
        }
        //console.log('return formatedValue Chuteira: ',formatedValue)
        return formatedValue;
      } //Fim do formatShoes - Formatação do Número da Chuteira

      //Telefone
      formatPhone(varPhone) {
        //console.log('Estou no formatPhone - varPhone: ',varPhone)

        var formatedValue = varPhone;
        if (formatedValue.length > 2) {

          formatedValue = formatedValue.replace(/\D/gi,'');                    
          formatedValue = formatedValue.replace(/(\d{2})(\d)/gi,'$1 $2');       
          formatedValue = formatedValue.replace(/(\d{5})(\d)/gi,'$1-$2');       
          formatedValue = formatedValue.replace(/(\d{4})(\d)/gi,'$1$2'); 

          //console.log('formatPhone - formatedValue: ',formatedValue)
        } 

        //console.log('return formatedValue Telefone: ',formatedValue)
        //return formatedValue;
        return this.formatField(formatedValue, this.phonemask, this.tammaskphone);

      } //Fim do formatPhone - Formatação do Telefone      
      
      //Função para formatar conteúdo digitado no input conforme definição de máscara
      formatField(campo: string, Mascara: string, tamanho: number): any {
        if (!tamanho) { tamanho = 99999999999; }
        let boleanoMascara;
        const exp = /\-|\.|\/|\(|\)|\,|\*|\+|\@|\#|\$|\&|\%|\:| /gi;
        const campoSoNumeros = campo.toString().replace(exp, '');
        let posicaoCampo = 0;
        let NovoValorCampo = '';
        let TamanhoMascara = campoSoNumeros.length;
        for (let i = 0; i < TamanhoMascara; i++) {
          if (i < tamanho) {
            boleanoMascara = ((Mascara.charAt(i) === '-') || (Mascara.charAt(i) === '.') || (Mascara.charAt(i) === '/'));
            boleanoMascara = boleanoMascara || ((Mascara.charAt(i) === '(') || (Mascara.charAt(i) === ')') || (Mascara.charAt(i) === ' '));
            boleanoMascara = boleanoMascara || ((Mascara.charAt(i) === ',') || (Mascara.charAt(i) === '*') || (Mascara.charAt(i) === '+'));
            boleanoMascara = boleanoMascara || ((Mascara.charAt(i) === '@') || (Mascara.charAt(i) === '#') || (Mascara.charAt(i) === ':'));
            boleanoMascara = boleanoMascara || ((Mascara.charAt(i) === '$') || (Mascara.charAt(i) === '&') || (Mascara.charAt(i) === '%'));
            if (boleanoMascara) {
              NovoValorCampo += Mascara.charAt(i);
              TamanhoMascara++;
            } else {
              NovoValorCampo += campoSoNumeros.charAt(posicaoCampo);
              posicaoCampo++;
            }
          }
        }
        return NovoValorCampo;
      }
      //Ita - 26/04/2018
      //Methodo para recuperar nome da Função do Usuário para apresentar no formulário perfilPage
      getRoleName(idPerfForm: string) {
        console.log('Estou no getRoleName - idPerfForm: ',idPerfForm)
        var nameRole = '';
        var query = new Parse.Query(Parse.Role);
        //query.equalTo("id", idPerfForm);  // procura Role(Função) pelo id(único) do registro.
        query.find({
          success: function(dados) {
            // Do stuff
          }      
        }).then((datFuncoes)=>{
          console.log('Estou no then getRoleName - datFuncoes: ',datFuncoes)
    
          for (var i = 0; i < datFuncoes.length; i++) {
            var objFuncoes = datFuncoes[i];
            console.log('Percorrendo Funções ... ' + i)
            console.log('objFuncoes.id '+objFuncoes.id+' == '+idPerfForm+' idPerfForm')
            //console.log('objFuncoes.id ',objFuncoes.id)
            //console.log('idPerfForm: ', idPerfForm)
              if (objFuncoes.id == idPerfForm) {
                nameRole = objFuncoes.get("name");
                console.log('Pegei nome da Função: ',nameRole)
              }
          }        
          console.log('Nome da Função que será retornado - nameRole: ',nameRole)
          
        })
        return nameRole;
      } //Fim do getRolename

      clearString(value, validCharacters) {
        var result = '';
        var index = -1;
        var i = 0;
      
        for(i = 0; i < value.length; i++) {
          index = validCharacters.indexOf(value.charAt(i));
      
         if(index > -1) {
            result += validCharacters.charAt(index);
          }
        }
        return result;
      }
      doCheckRole(event) {
        console.log('Estou no doCheckRole - O Evento foi ',event)
      }
} //Fim do export class PerfilPage

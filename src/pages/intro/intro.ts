import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
//import { TabsPage } from '../tabs/tabs';
import { AutenticacaoPage } from '../autenticacao/autenticacao';

/**
 * Generated class for the IntroPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-intro',
  templateUrl: 'intro.html',
})
export class IntroPage {

  constructor(public navCtrl: NavController, 
              public navParams: NavParams) {
  }

  ionViewDidLoad() {
    //console.log('ionViewDidLoad IntroPage');
  }
  goToIniPage(){
    //this.navCtrl.push(TabsPage)
    this.navCtrl.push(AutenticacaoPage)
  }
}

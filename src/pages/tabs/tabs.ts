import { Component } from '@angular/core';

//import { AboutPage } from '../about/about';
//import { ContactPage } from '../contact/contact';
import { HomePage } from '../home/home';
import { FeedPage } from '../feed/feed';
import { ConfiguracoesPage } from '../configuracoes/configuracoes';
import { AtletasPage } from '../atletas/atletas';
import { AutenticacaoPage } from '../autenticacao/autenticacao';

@Component({
  selector: 'page-tabs',  //Ita - 26/03/2018
  templateUrl: 'tabs.html'
})
export class TabsPage {

  tab1Root = HomePage;
  /*tab2Root = AboutPage;
  tab3Root = ContactPage;*/
  tab4Root = FeedPage;
  tab5Root = ConfiguracoesPage;
  tab6Root = AtletasPage;
  tab7Root = AutenticacaoPage;

  constructor() {

  }
}

import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { MovieProvider } from '../../providers/movie/movie';

/**
 * Generated class for the FilmedetalhesPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-filmedetalhes',
  templateUrl: 'filmedetalhes.html',
  providers: [MovieProvider]
})
export class FilmedetalhesPage {
  public filme;
  public filmeid;
  
  constructor(public navCtrl: NavController, 
              public navParams: NavParams,
              public movieProvider: MovieProvider
            ) {
  }
  //Ita - 05/03/2018
  //      Trocar o ionViewDidLoad() - Carrega uma única vez 
  //      por
  //      ionViewDidEnter() - Carrega sempre que entrar na página.
  ionViewDidEnter() {
    this.filmeid = this.navParams.get("id");
    this.movieProvider.getMoviesDetails(this.filmeid).subscribe(data=>{
      let retorno = (data as any); //(data as any)._body;
      //console.log(retorno);
      this.filme = retorno;//JSON.parse(retorno);
    },error=>{
      //console.log(error);
    })
    //console.log('filme id recebido: ',this.filmeid);
    //console.log('ionViewDidLoad FilmedetalhesPage');
  }

}

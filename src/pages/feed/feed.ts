import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, LoadingController } from 'ionic-angular';
import { MovieProvider } from '../../providers/movie/movie';
import { FilmedetalhesPage } from '../filmedetalhes/filmedetalhes';

/**
 * Generated class for the FeedPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-feed',
  templateUrl: 'feed.html',
  providers: [
    MovieProvider
  ]
})
export class FeedPage {
  //public nome_usuario:string = "Ita(Código)";
  
  
  public objeto_feed = {
    titulo: "Ita",
    data:"Fevereiro 22, 2018",
    descricao:"Sejam Bemvindo ao Controle de Bola, o aplicativo que fará de você um atleta de verdade.",
    qntd_likes:12,
    qntd_comments:4,
    time_comment:"11h fev"
  }

  public loader;
  public refresher;                    //Ita - Variáveis para controlar
  public isrefresher: boolean = false; //      Refresh da página
  public lista_filmes: Array<any>;
  public page = 1;
  public infiniteScroll;
//public lista_filmes = new Array<any>();

  constructor(public navCtrl: NavController, 
              public navParams: NavParams,
              private movieProvider: MovieProvider,
              public loadingCtrl: LoadingController
            ) {
  }

  abrirCarregando() {
    this.loader = this.loadingCtrl.create({
      content: "Carregando Filmes ..."//,
      //duration: 3000 //Ita - 04/03/2018
                       //Calculado em milissegundos, no exemplo ficará exibindo 
                       //por três segundo.
                       //Se não existir esta linha, a mensagem permanecerá
                       // na tela pelo mesmo tempo que durá o carregamento.
    });
    this.loader.present();
  }

  fecharCarregando() {
    this.loader.dismiss();//Função dismiss encontra-se na documentação do ionic.
  }

  public somaDoisnumeros(num1:number,num2:number){
    alert(num1+num2)
  }

  //Ita - 04/03/2018
  //      Função para fazer refresh do carregamento de filmes.

  doRefresh(refresher) {
    this.refresher = refresher;
    this.isrefresher = true;
    this.carregarFimes();
  }

  //ionViewDidLoad() - Ita - A função ionViewDidLoad() só carrega uma
  //                   única vez, só carrega novament quando a página
  //                   for reciclada, ou seja, quando o ciclo de vida
  //                   do App destruir esta página e ela for recriada
  //                   novamente.
  //ionViewDidEnter() - Ita - A função ionViewDidEnter() carrega
  //                   sempre que se entra na página.
  ionViewDidEnter() {
    //this.somaDoisnumeros(3,4);
    //console.log('ionViewDidLoad FeedPage');
    this.carregarFimes();
  }

  abrirDetalhes(filme) {
    console.log(filme);
    this.navCtrl.push(FilmedetalhesPage,{id: filme.id}); //Ita - 05/03/2018 - Função navCtrl faz a mágica de abrir a página.
  }

  doInfinite(infiniteScroll) {
    this.page ++;
    this.infiniteScroll = infiniteScroll
    this.carregarFimes(true);
    //console.log('Begin async operation');
    //infiniteScroll.complete();
    /*
    setTimeout(() => {
      for (let i = 0; i < 30; i++) {
        this.items.push( this.items.length );
      }

      console.log('Async operation has ended');
      infiniteScroll.complete();
    }, 500);
    */
  }

  carregarFimes(newpage: boolean = false) {
    this.abrirCarregando();//Ita - Toda vez que entrar na página irá
                           //exibir a mensagem Carregando Filmes...
    this.movieProvider.getLastesMovies(this.page).subscribe(
      data=>{
        //this.lista_filmes = data.results;
        //console.log(data.results);
        const response = (data as any);
        if(newpage){
          this.lista_filmes = this.lista_filmes.concat(response.results);//Se não for a primeira vez, concatena novos filmes a lista anterior.
          console.log('resposta completa RECARREGADA: ',response)
          console.log('page RECARRREGADA: ',this.page);
          console.log('filmes RECARREGADOS:' ,this.lista_filmes);
          this.infiniteScroll.complete();
        }else{
          this.lista_filmes = response.results;
          console.log('resposta completa PRIMEIRA VEZ: ',response)
          console.log('page PRIMEIRA VEZ: ',this.page);
          console.log('filmes PRMEIRA VEZ:' ,this.lista_filmes);
          
        }
        //console.log(response.results);
        //const objeto_retorno = JSON.parse(response._body);
        //this.lista_filmes = objeto_retorno.results;
        //console.log(objeto_retorno);
        //console.log(this.lista_filmes);
        this.fecharCarregando();//Fecha a mensagem: Carregando Films...
        if(this.isrefresher){
          this.refresher.complete();
          this.isrefresher = false;
        }
      },error=>{
        console.log(error);
        this.fecharCarregando();
        if(this.isrefresher){
            this.refresher.complete();
            this.isrefresher = false;        
      }   
    }
  )
}
}
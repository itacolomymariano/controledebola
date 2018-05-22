import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

/*
  Generated class for the MovieProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class MovieProvider {
  private baseApiPath = "https://api.themoviedb.org/3";
  //private ultimo_filme_postado = "/movie/latest?api_key=";
  private filmes_mais_populares = "/movie/popular";
  private textoapikey = "?api_key=";
  //private keyApiControledeBola = "?api_key=5338187e0b268bbf06080c38b2529052";
  constructor(public http: HttpClient) {
    console.log('Hello MovieProvider Provider');
  }
/*
  Ita - 25/02/2018
  Criado método para consumir API - Últimos Filmes
*/
  getLastesMovies(page = 1){
    //return this.http.get(this.baseApiPath + this.filmes_mais_populares + this.keyApiControledeBola)
    //console.log('page no getLastesMovies: ',page);
    //let recpag = this.baseApiPath + this.filmes_mais_populares + '?' + page + '&api_key=' + this.getApikey()
    //console.log('recpag: ',recpag)
    return this.http.get(this.baseApiPath + this.filmes_mais_populares + '?page=' + page + '&api_key=' + this.getApikey())
    //return this.http.get(this.baseApiPath + "/movie/latest?api_key=5338187e0b268bbf06080c38b2529052")
  }
  //Ita - 05/03/2018 - Detalhes do Filme
  getMoviesDetails(filmeid){
    //Exemplo de concatenação com crase ao invés de sinal de adição +
    //s{filmeid}
    // '/movie/s{filmeid}?api_key='
    //return this.http.get(this.baseApiPath + '/movie/s{filmeid}?api_key=' + this.getApikey())
    return this.http.get(this.baseApiPath + '/movie/' + filmeid + this.textoapikey + this.getApikey())
    //return this.http.get(this.baseApiPath + "/movie/latest?api_key=5338187e0b268bbf06080c38b2529052")
  }

  getApikey(): string{ 
    return '5338187e0b268bbf06080c38b2529052'} 
  
}

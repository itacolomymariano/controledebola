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
  //private ultimo_filme_postado = "/movie/latest";
  private filmes_mais_populares = "/movie/popular";
  private keyApiControledeBola = "?api_key=5338187e0b268bbf06080c38b2529052";
  constructor(public http: HttpClient) {
    console.log('Hello MovieProvider Provider');
  }
/*
  Ita - 25/02/2018
  Criado método para consumir API - Últimos Filmes
*/
  getLastesMovies(){
    return this.http.get(this.baseApiPath + this.filmes_mais_populares + this.keyApiControledeBola)
    //return this.http.get(this.baseApiPath + "/movie/latest?api_key=5338187e0b268bbf06080c38b2529052")
  }

}

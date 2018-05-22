import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular';
//import { Http } from '@angular/http';
//import 'rxjs/add/operator/map';

/*
  Generated class for the CartolaProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class CartolaProvider {
  basepath = "/cartolaapi"
  constructor(
    public http: HttpClient,
    //public http: Http,
    private _platform: Platform
  ) {
    if(this._platform.is("cordova")){
      this.basepath = "https://api.cartolafc.globo.com"
      console.log('Plataforma é Cordova: basepath = ', this.basepath)
    } else {
      console.log('Plataforma Não é Cordova: basepath = ', this.basepath)
    }
//    console.log('Hello CartolaProvider Provider');
  }
  atletas(){
  //return this.http.get('https://api.cartolafc.globo.com/atletas/mercado');
  return this.http.get(this.basepath + '/atletas/mercado');
  }
}

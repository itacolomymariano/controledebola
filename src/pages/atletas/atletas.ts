import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { CartolaProvider } from '../../providers/cartola/cartola';
import { Camera, CameraOptions } from '@ionic-native/camera';


/**
 * Generated class for the AtletasPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-atletas',
  templateUrl: 'atletas.html',
  providers: [
    CartolaProvider,
    Camera
  ]
})
export class AtletasPage {
  img = "";
  constructor(public navCtrl: NavController, 
              public navParams: NavParams,
              private _cartolaProvide: CartolaProvider,
              private camera: Camera
            ) {
  }

  ionViewDidLoad() {
    //console.log('ionViewDidLoad AtletasPage');
    this._cartolaProvide.atletas().subscribe(date=>{
      console.log(date)
    })
  }

  tirarfoto() {
    const options: CameraOptions = {
      quality: 100,
      destinationType: this.camera.DestinationType.DATA_URL,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE
    }
    
    this.camera.getPicture(options).then((imageData) => {
     // imageData is either a base64 encoded string or a file URI
     // If it's base64:
     //let base64Image = 'data:image/jpeg;base64,' + imageData;
     this.img = 'data:image/jpeg;base64,' + imageData;
    }, (err) => {
     // Handle error
    });    
  }

}

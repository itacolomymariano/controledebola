import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-image-lightbox',
  templateUrl: './image-lightbox.component.html',
  styleUrls: ['./image-lightbox.component.scss'],
  standalone: false,
})
export class ImageLightboxComponent {
  @Input() imageSrc = '';
  @Input() imageAlt = '';

  constructor(private readonly modalCtrl: ModalController) {}

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }
}

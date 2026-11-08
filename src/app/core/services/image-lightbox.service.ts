import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';

@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
  constructor(private readonly modalCtrl: ModalController) {}

  async open(imageSrc: string, imageAlt: string): Promise<void> {
    if (!imageSrc?.trim()) return;
    const modal = await this.modalCtrl.create({
      component: ImageLightboxComponent,
      componentProps: { imageSrc, imageAlt },
      cssClass: 'image-lightbox-modal',
    });
    await modal.present();
  }
}

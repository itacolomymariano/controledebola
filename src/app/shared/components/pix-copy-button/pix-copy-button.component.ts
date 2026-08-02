import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { copyTextToClipboard } from '../../../core/utils/clipboard.util';

@Component({
  selector: 'app-pix-copy-button',
  templateUrl: './pix-copy-button.component.html',
  styleUrls: ['./pix-copy-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PixCopyButtonComponent {
  @Input({ required: true }) text = '';
  @Input() ariaLabel = 'Copiar chave PIX';

  constructor(private readonly toastCtrl: ToastController) {}

  get hasContent(): boolean {
    return !!this.text?.trim();
  }

  async copy(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const ok = await copyTextToClipboard(this.text);
    const toast = await this.toastCtrl.create({
      message: ok ? 'Chave PIX copiada' : 'Nao foi possivel copiar',
      duration: 2000,
      color: ok ? 'success' : 'danger',
    });
    await toast.present();
  }
}

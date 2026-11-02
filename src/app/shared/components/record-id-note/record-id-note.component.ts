import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-record-id-note',
  templateUrl: './record-id-note.component.html',
  styleUrls: ['./record-id-note.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RecordIdNoteComponent {
  @Input({ required: true }) recordId = '';

  constructor(private readonly toastCtrl: ToastController) {}

  async copyId(): Promise<void> {
    const id = this.recordId.trim();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      const toast = await this.toastCtrl.create({
        message: 'ID copiado',
        duration: 1500,
        color: 'success',
      });
      await toast.present();
    } catch {
      /* clipboard unavailable */
    }
  }
}

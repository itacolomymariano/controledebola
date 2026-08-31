import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-image-picker',
  templateUrl: './image-picker.component.html',
  styleUrls: ['./image-picker.component.scss'],
  standalone: false,
})
export class ImagePickerComponent {
  @Input() label = 'Selecionar imagem';
  @Input() hint = 'Formatos de imagem, ate 5 MB.';
  @Input() previewUrl: string | null = null;
  @Input() disabled = false;

  @Output() imageSelected = new EventEmitter<File>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  async openPicker(): Promise<void> {
    if (this.disabled) return;

    if (Capacitor.isNativePlatform()) {
      await this.openNativePicker();
      return;
    }

    this.fileInput?.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.emitFile(file);
  }

  private async openNativePicker(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        width: 1024,
        height: 1024,
        correctOrientation: true,
      });

      const dataUrl = photo.dataUrl;
      if (!dataUrl) return;

      const file = dataUrlToJpegFile(dataUrl, `photo-${Date.now()}.jpg`);
      this.emitFile(file);
    } catch (error: unknown) {
      if (isPickerCanceled(error)) return;
      this.fileInput?.nativeElement.click();
    }
  }

  private emitFile(file: File): void {
    try {
      this.previewUrl = URL.createObjectURL(file);
    } catch {
      // preview e opcional
    }
    this.imageSelected.emit(file);
  }
}

function dataUrlToJpegFile(dataUrl: string, fileName: string): File {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  return new File([bytes], fileName, { type: mime, lastModified: Date.now() });
}

function isPickerCanceled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel|dismiss|user cancelled/i.test(message);
}

import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

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

  openPicker(): void {
    if (this.disabled) return;
    this.fileInput?.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.previewUrl = URL.createObjectURL(file);
    this.imageSelected.emit(file);
    input.value = '';
  }
}

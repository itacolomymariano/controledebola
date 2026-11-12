import { Component, HostBinding, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ImageLightboxService } from '../../../core/services/image-lightbox.service';

@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.scss'],
  standalone: false,
})
export class UserAvatarComponent implements OnChanges {
  @Input() avatarUrl: string | null | undefined;
  @Input() alt = 'Foto de perfil';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() zoomable = false;
  @Input() zoomDisabled = false;

  @HostBinding('class.user-avatar--zoomable')
  get zoomableHost(): boolean {
    return this.canZoom;
  }

  imageBroken = false;

  constructor(private readonly imageLightbox: ImageLightboxService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['avatarUrl']) {
      this.imageBroken = false;
    }
  }

  onImageError(): void {
    this.imageBroken = true;
  }

  get showImage(): boolean {
    return !!this.avatarUrl?.trim() && !this.imageBroken;
  }

  get canZoom(): boolean {
    return !!this.zoomable && !this.zoomDisabled && this.showImage;
  }

  onAvatarClick(event?: Event): void {
    if (!this.canZoom) return;
    event?.stopPropagation();
    const url = this.avatarUrl?.trim();
    if (!url) return;
    void this.imageLightbox.open(url, this.alt);
  }
}

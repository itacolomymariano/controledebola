import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

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

  imageBroken = false;

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
}

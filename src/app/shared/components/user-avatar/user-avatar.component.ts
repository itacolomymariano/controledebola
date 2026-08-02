import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.scss'],
  standalone: false,
})
export class UserAvatarComponent {
  @Input() avatarUrl: string | null | undefined;
  @Input() alt = 'Foto de perfil';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
}

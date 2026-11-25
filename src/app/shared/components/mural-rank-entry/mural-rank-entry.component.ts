import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LocaleRefreshDirective } from '../../directives/locale-refresh.directive';
import { PlayfulCardTone } from '../playful-card/playful-card.component';

@Component({
  selector: 'app-mural-rank-entry',
  templateUrl: './mural-rank-entry.component.html',
  styleUrls: ['./mural-rank-entry.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [LocaleRefreshDirective],
  standalone: false,
})
export class MuralRankEntryComponent {
  @Input({ required: true }) rank = 1;
  @Input({ required: true }) userName = '';
  @Input() avatarUrl?: string;
  @Input() badge = '';
  @Input() tone: PlayfulCardTone = 'users';
  @Input() primaryPosition?: string;
  @Input() age?: number;
  @Input() locationLine = '';

  toneClass(): string {
    return `mural-playful-rank-entry--${this.tone}`;
  }

  positionDisplay(value: string): string {
    const v = value.trim();
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
}
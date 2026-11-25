import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LocaleRefreshDirective } from '../../directives/locale-refresh.directive';

@Component({
  selector: 'app-playful-grid',
  templateUrl: './playful-grid.component.html',
  styleUrls: ['./playful-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [LocaleRefreshDirective],
  standalone: false,
})
export class PlayfulGridComponent {}

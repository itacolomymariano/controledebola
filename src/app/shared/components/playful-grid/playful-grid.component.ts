import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-playful-grid',
  templateUrl: './playful-grid.component.html',
  styleUrls: ['./playful-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PlayfulGridComponent {}

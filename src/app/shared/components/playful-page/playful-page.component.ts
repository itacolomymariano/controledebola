import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Envolve o conteúdo de `ion-content` com fundo playful (gradiente + orbes) e safe-area inferior.
 * Use: `ion-content` com classe `cb-playful-ion-content` + este componente como primeiro filho.
 */
@Component({
  selector: 'app-playful-page',
  templateUrl: './playful-page.component.html',
  styleUrls: ['./playful-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PlayfulPageComponent {}

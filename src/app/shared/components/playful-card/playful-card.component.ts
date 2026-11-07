import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
} from '@angular/core';

export type PlayfulCardTone = 'surface' | 'muted' | 'peladas' | 'confrontos' | 'times' | 'users';

@Component({
  selector: 'app-playful-card',
  templateUrl: './playful-card.component.html',
  styleUrls: ['./playful-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PlayfulCardComponent {
  /** Quando true, adiciona hover/active leve (útil em listas clicáveis com cursor). */
  @Input() interactive = false;

  @Input() tone: PlayfulCardTone = 'surface';

  /**
   * Botão circular com seta (mock Nicole). `null` = ligado para tons peladas|confrontos|times|users.
   */
  @Input() showGo: boolean | null = null;

  /** Camada de “ondas” decorativas. `null` = igual a showGo. */
  @Input() showWaves: boolean | null = null;

  @Output() readonly activate = new EventEmitter<MouseEvent | KeyboardEvent>();

  @HostBinding('style.cursor')
  get cursorStyle(): string | null {
    return this.interactive ? 'pointer' : null;
  }

  @HostBinding('attr.role')
  get a11yRole(): string | null {
    return this.interactive ? 'button' : null;
  }

  @HostBinding('attr.tabindex')
  get tabIndex(): number | null {
    return this.interactive ? 0 : null;
  }

  @HostListener('click', ['$event'])
  onClick(ev: MouseEvent): void {
    if (this.interactive) {
      this.activate.emit(ev);
    }
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  onKeyActivate(ev: KeyboardEvent): void {
    if (!this.interactive) return;
    ev.preventDefault();
    this.activate.emit(ev);
  }

  @HostBinding('class')
  get hostClass(): string {
    const base = 'cb-playful-card';
    const toneClass = `cb-playful-card--${this.tone}`;
    const inter = this.interactive ? 'cb-playful-card--interactive' : '';
    return [base, toneClass, inter].filter(Boolean).join(' ');
  }

  get showGoDecoration(): boolean {
    if (this.showGo === true) return true;
    if (this.showGo === false) return false;
    const door = ['peladas', 'confrontos', 'times', 'users'].includes(this.tone);
    return door && this.interactive;
  }

  get showWaveLayer(): boolean {
    if (this.showWaves === true) return true;
    if (this.showWaves === false) return false;
    const door = ['peladas', 'confrontos', 'times', 'users'].includes(this.tone);
    return door && this.interactive;
  }
}

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type HomeDoorVariant = 'peladas' | 'confrontos' | 'times' | 'users';

@Component({
  selector: 'app-home-door-card',
  templateUrl: './home-door-card.component.html',
  styleUrls: ['./home-door-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HomeDoorCardComponent {
  @Input({ required: true }) titleKey!: string;
  @Input({ required: true }) hintKey!: string;
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) variant!: HomeDoorVariant;

  @Output() readonly activate = new EventEmitter<void>();

  onActivate(): void {
    this.activate.emit();
  }
}

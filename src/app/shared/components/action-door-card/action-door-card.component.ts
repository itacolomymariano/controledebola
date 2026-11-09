import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { HomeDoorVariant } from '../home-door-card/home-door-card.component';

@Component({
  selector: 'app-action-door-card',
  templateUrl: './action-door-card.component.html',
  styleUrls: ['./action-door-card.component.scss', '../home-door-card/home-door-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ActionDoorCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) variant!: HomeDoorVariant;
  @Input() active = false;

  @Output() readonly activate = new EventEmitter<void>();

  onActivate(): void {
    this.activate.emit();
  }
}

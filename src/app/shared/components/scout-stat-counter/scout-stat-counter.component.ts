import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-scout-stat-counter',
  templateUrl: './scout-stat-counter.component.html',
  styleUrls: ['./scout-stat-counter.component.scss'],
  standalone: false,
})
export class ScoutStatCounterComponent {
  @Input() label = '';
  @Input() value = 0;
  @Input() disabled = false;
  @Input() compact = false;
  @Input() readonly = false;

  @Output() increment = new EventEmitter<void>();
  @Output() decrement = new EventEmitter<void>();

  onIncrement(): void {
    if (!this.disabled) {
      this.increment.emit();
    }
  }

  onDecrement(): void {
    if (!this.disabled && this.value > 0) {
      this.decrement.emit();
    }
  }
}

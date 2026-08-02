import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ScoutApontamentoAthlete } from '../../../core/models/scout-apontamento.model';

@Component({
  selector: 'app-scout-athlete-strip',
  templateUrl: './scout-athlete-strip.component.html',
  styleUrls: ['./scout-athlete-strip.component.scss'],
  standalone: false,
})
export class ScoutAthleteStripComponent {
  @Input() athletes: ScoutApontamentoAthlete[] = [];
  @Input() selectedUserId = '';
  @Input() disabled = false;

  @Output() athleteSelected = new EventEmitter<string>();

  selectAthlete(userId: string): void {
    if (!this.disabled) {
      this.athleteSelected.emit(userId);
    }
  }
}

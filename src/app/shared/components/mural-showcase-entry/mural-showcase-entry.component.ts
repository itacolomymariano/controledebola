import { Component, Input } from '@angular/core';
import { MuralShowcaseEntry } from '../../../core/models/mural-highlights.model';

@Component({
  selector: 'app-mural-showcase-entry',
  templateUrl: './mural-showcase-entry.component.html',
  styleUrls: ['./mural-showcase-entry.component.scss'],
  standalone: false,
})
export class MuralShowcaseEntryComponent {
  @Input({ required: true }) entry!: MuralShowcaseEntry;

  formatScore(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}

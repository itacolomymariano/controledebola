import { Component, Input } from '@angular/core';
import {
  MURAL_AGE_BAND_LABELS,
  MuralAgeBand,
  MuralAgeBandWinners,
  MuralHighlights,
  MuralShowcaseEntry,
} from '../../../core/models/mural-highlights.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';

@Component({
  selector: 'app-mural-highlights-panel',
  templateUrl: './mural-highlights-panel.component.html',
  styleUrls: ['./mural-highlights-panel.component.scss'],
  standalone: false,
})
export class MuralHighlightsPanelComponent {
  @Input() highlights: MuralHighlights | null = null;
  @Input() scope: 'app' | 'pelada' | 'event' = 'pelada';
  @Input() shareContext: MuralShareContext | null = null;

  ageBands: MuralAgeBand[] = ['sub30', 'sub60', 'plus60'];

  get showBirthdays(): boolean {
    return this.scope === 'pelada';
  }

  get eventGoleador(): MuralShowcaseEntry | null {
    return this.highlights?.goleador.sub30 ?? null;
  }

  get eventMelhorGoleiro(): MuralShowcaseEntry | null {
    return this.highlights?.melhorGoleiro.sub30 ?? null;
  }

  get eventCraque(): MuralShowcaseEntry | null {
    return this.highlights?.craque.sub30 ?? null;
  }

  get craqueTitle(): string {
    if (this.scope === 'app') return 'Craques';
    if (this.scope === 'event') return 'Craque do Evento';
    return 'Craque da Pelada';
  }

  get goleadorTitle(): string {
    if (this.scope === 'app') return 'Goleadores';
    if (this.scope === 'event') return 'Goleador do Evento';
    return 'Goleador';
  }

  get melhorGoleiroTitle(): string {
    if (this.scope === 'app') return 'Melhores Goleiros';
    if (this.scope === 'event') return 'Melhor Goleiro do Evento';
    return 'Melhor Goleiro';
  }

  get melhorJuizTitle(): string {
    return 'Melhor Juiz / Árbitro';
  }

  ageBandLabel(band: MuralAgeBand): string {
    return MURAL_AGE_BAND_LABELS[band];
  }

  ageBandHeading(band: MuralAgeBand, entry: MuralShowcaseEntry | null): string {
    const label = this.ageBandLabel(band);
    if (entry?.age !== undefined) {
      return `${label} — ${entry.age} anos`;
    }
    return label;
  }

  winnerForBand(winners: MuralAgeBandWinners, band: MuralAgeBand): MuralShowcaseEntry | null {
    return winners[band];
  }
}

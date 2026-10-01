import { Component, Input } from '@angular/core';
import {
  MURAL_AGE_BAND_LABELS,
  MuralAgeBand,
  MuralAgeBandWinnerLists,
  MuralAgeBandWinners,
  MuralHighlights,
  MuralShowcaseEntry,
} from '../../../core/models/mural-highlights.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralAppTab } from '../../../core/config/mural-app-sections.config';

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
  /** Mural global por aba (Peladas / Confrontos / Geral). */
  @Input() appBucketTab: MuralAppTab | null = null;
  @Input() titleOverrides: {
    craque: string;
    goalkeeper: string;
    scorer: string;
  } | null = null;
  /** Frase do filtro de regiao (Brasil ou Filtro: Estado...). Vazia fora do mural do app. */
  @Input() filterCaption = '';

  ageBands: MuralAgeBand[] = ['sub30', 'sub60', 'plus60'];

  get showBirthdays(): boolean {
    return this.scope === 'pelada';
  }

  get eventGoleadores(): MuralShowcaseEntry[] {
    return this.highlights?.goleador?.sub30 ?? [];
  }

  get eventMelhorGoleiro(): MuralShowcaseEntry | null {
    return this.highlights?.melhorGoleiro?.sub30 ?? null;
  }

  get eventCraque(): MuralShowcaseEntry | null {
    return this.highlights?.craque?.sub30 ?? null;
  }

  get craqueTitle(): string {
    if (this.titleOverrides?.craque) return this.titleOverrides.craque;
    if (this.scope === 'app') return 'Craques';
    if (this.scope === 'event') return 'Craque do Evento';
    return 'Craque da Pelada';
  }

  get goleadorTitle(): string {
    if (this.titleOverrides?.scorer) return this.titleOverrides.scorer;
    if (this.scope === 'app') return 'Goleadores';
    if (this.scope === 'event') return 'Goleador do Evento';
    return 'Goleador';
  }

  get melhorGoleiroTitle(): string {
    if (this.titleOverrides?.goalkeeper) return this.titleOverrides.goalkeeper;
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

  ageBandHeadingForList(band: MuralAgeBand, entries: MuralShowcaseEntry[]): string {
    return this.ageBandHeading(band, entries[0] ?? null);
  }

  winnerForBand(winners: MuralAgeBandWinners | undefined, band: MuralAgeBand): MuralShowcaseEntry | null {
    return winners?.[band] ?? null;
  }

  winnersForGoleadorBand(
    winners: MuralAgeBandWinnerLists | undefined,
    band: MuralAgeBand
  ): MuralShowcaseEntry[] {
    return winners?.[band] ?? [];
  }
}

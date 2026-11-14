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
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-mural-highlights-panel',
  templateUrl: './mural-highlights-panel.component.html',
  styleUrls: ['./mural-highlights-panel.component.scss'],
  standalone: false,
})
export class MuralHighlightsPanelComponent {
  constructor(private readonly i18n: I18nService) {}

  @Input() highlights: MuralHighlights | null = null;
  @Input() scope: 'app' | 'pelada' | 'event' = 'pelada';
  @Input() scopeId = '';
  @Input() shareContext: MuralShareContext | null = null;
  @Input() appBucketTab: MuralAppTab | null = null;
  @Input() titleOverrides: {
    craque: string;
    goalkeeper: string;
    scorer: string;
  } | null = null;
  @Input() filterCaption = '';
  @Input() layout: 'default' | 'eventOrdered' = 'default';
  @Input() playfulChrome = false;

  get showPlayfulHero(): boolean {
    if (!this.playfulChrome || !this.highlights) return false;
    if (this.scope === 'app') return this.appBucketTab === 'geral';
    return this.scope === 'pelada' || this.scope === 'event';
  }

  get showPlayfulExtraCards(): boolean {
    return this.showPlayfulHero;
  }

  get heroCraque(): MuralShowcaseEntry | null {
    if (this.scope === 'event' || (this.scope === 'app' && this.appBucketTab)) {
      return this.eventCraque;
    }
    if (this.scope === 'pelada') {
      for (const band of this.ageBands) {
        const w = this.winnerForBand(this.highlights?.craque, band);
        if (w) return w;
      }
    }
    return null;
  }

  get tileGoleador(): MuralShowcaseEntry | null {
    const list = this.scope === 'event' || (this.scope === 'app' && this.appBucketTab)
      ? this.eventGoleadores
      : this.winnersForGoleadorBand(this.highlights?.goleador, 'sub30');
    return list[0] ?? null;
  }

  get showPlayfulTeamTile(): boolean {
    return this.scope !== 'event';
  }

  get showPlayfulJuizTile(): boolean {
    return this.scope === 'event' || this.scope === 'app';
  }

  ageBands: MuralAgeBand[] = ['sub30', 'sub60', 'plus60'];

  get isEventOrdered(): boolean {
    return this.layout === 'eventOrdered' && this.scope === 'event';
  }

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
    if (this.scope === 'app') return this.i18n.t('mural.highlights.craques.app');
    if (this.scope === 'event') return this.i18n.t('mural.highlights.craques.event');
    return this.i18n.t('mural.highlights.craques.pelada');
  }

  get goleadorTitle(): string {
    if (this.titleOverrides?.scorer) return this.titleOverrides.scorer;
    if (this.scope === 'app') return this.i18n.t('mural.highlights.goleadores.app');
    if (this.scope === 'event') return this.i18n.t('mural.highlights.goleadores.event');
    return this.i18n.t('mural.highlights.goleadores.pelada');
  }

  get melhorGoleiroTitle(): string {
    if (this.titleOverrides?.goalkeeper) return this.titleOverrides.goalkeeper;
    if (this.scope === 'app') return this.i18n.t('mural.highlights.goleiro.app');
    if (this.scope === 'event') return this.i18n.t('mural.highlights.goleiro.event');
    return this.i18n.t('mural.highlights.goleiro.pelada');
  }

  get melhorJuizTitle(): string {
    return this.i18n.t('mural.highlights.melhorJuiz');
  }

  promessaTitle(): string {
    return this.i18n.t('mural.highlights.promessa');
  }

  masterTitle(): string {
    return this.i18n.t('mural.highlights.master');
  }

  fansCountLabel(count: number): string {
    return this.i18n.t('mural.highlights.fansCount', { count });
  }

  ageBandLabel(band: MuralAgeBand): string {
    return MURAL_AGE_BAND_LABELS[band];
  }

  ageBandHeading(band: MuralAgeBand, entry: MuralShowcaseEntry | null): string {
    const label = this.ageBandLabel(band);
    if (entry?.age !== undefined) {
      return `${label} — ${this.i18n.t('mural.highlights.ageYears', { age: entry.age })}`;
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
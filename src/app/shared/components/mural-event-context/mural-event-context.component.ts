import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { I18nService } from '../../../core/services/i18n.service';
import { formatAppDateTime } from '../../../core/utils/locale-datetime.util';

@Component({
  selector: 'app-mural-event-context',
  templateUrl: './mural-event-context.component.html',
  styleUrls: ['./mural-event-context.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralEventContextComponent implements OnDestroy {
  @Input() context: MuralShareContext | null = null;
  private localeSub?: Subscription;

  constructor(
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  get show(): boolean {
    return this.context?.scope === 'event';
  }

  get eventDateLabel(): string {
    const raw = this.context?.eventStartTime;
    if (!raw) return '';
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return formatAppDateTime(date, this.i18n.locale);
  }

  get showTeamMatch(): boolean {
    return !!(this.context?.homeTeamName && this.context?.awayTeamName);
  }

  get showScores(): boolean {
    return (
      this.showTeamMatch &&
      this.context!.homeScore != null &&
      this.context!.awayScore != null
    );
  }

  journalistLabel(name: string): string {
    return this.i18n.t('mural.eventContext.journalist', { name });
  }
}
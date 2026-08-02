import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EventMediaDashboard } from '../../core/models/event-media.model';
import { EventMediaService } from '../../core/services/event-media.service';
import { resolveRouteParam } from '../../core/utils/route-param.util';

@Component({
  selector: 'app-event-mural-media-radio',
  templateUrl: './event-mural-media-radio.page.html',
  styleUrls: ['./event-mural-media.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventMuralMediaRadioPage {
  eventId = '';
  loading = true;
  dashboard: EventMediaDashboard | null = null;
  loadError = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly eventMediaService: EventMediaService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    this.eventId = resolveRouteParam(this.route, 'id');
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      if (!this.eventId) {
        this.loadError = 'Evento nao identificado. Volte ao mural e abra a cobertura novamente.';
        this.dashboard = null;
        return;
      }
      this.dashboard = await this.eventMediaService.loadDashboard(this.eventId);
    } catch (error: unknown) {
      this.loadError = this.eventMediaService.errorMessage(
        error,
        'Nao foi possivel carregar o radio do evento.'
      );
      this.dashboard = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}

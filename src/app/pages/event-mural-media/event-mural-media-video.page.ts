import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EventMediaDashboard } from '../../core/models/event-media.model';
import { EventMediaService } from '../../core/services/event-media.service';
import { resolveRouteParam } from '../../core/utils/route-param.util';

@Component({
  selector: 'app-event-mural-media-video',
  templateUrl: './event-mural-media-video.page.html',
  styleUrls: ['./event-mural-media.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventMuralMediaVideoPage {
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

  formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
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
        'Nao foi possivel carregar o video do evento.'
      );
      this.dashboard = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}

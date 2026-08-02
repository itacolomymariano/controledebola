import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { resolveRouteParam } from '../../core/utils/route-param.util';

@Component({
  selector: 'app-event-mural-media-hub',
  templateUrl: './event-mural-media-hub.page.html',
  styleUrls: ['./event-mural-media.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventMuralMediaHubPage {
  eventId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ionViewWillEnter(): void {
    this.eventId = resolveRouteParam(this.route, 'id');
  }

  openRadio(): void {
    if (!this.eventId) return;
    void this.router.navigate(['/event', this.eventId, 'mural', 'media', 'radio']);
  }

  openJournal(): void {
    if (!this.eventId) return;
    void this.router.navigate(['/event', this.eventId, 'mural', 'media', 'journal']);
  }

  openVideo(): void {
    if (!this.eventId) return;
    void this.router.navigate(['/event', this.eventId, 'mural', 'media', 'video']);
  }
}

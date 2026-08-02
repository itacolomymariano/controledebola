import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EventMediaDashboard } from '../../core/models/event-media.model';
import { EventMediaService } from '../../core/services/event-media.service';
import { resolveRouteParam } from '../../core/utils/route-param.util';
import { EventMediaEngagementComponent } from '../../shared/components/event-media-engagement/event-media-engagement.component';

type JournalSection = 'reportage' | 'interview';

@Component({
  selector: 'app-event-mural-media-journal',
  templateUrl: './event-mural-media-journal.page.html',
  styleUrls: ['./event-mural-media.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventMuralMediaJournalPage {
  eventId = '';
  loading = true;
  activeSection: JournalSection = 'reportage';
  dashboard: EventMediaDashboard | null = null;
  loadError = '';

  @ViewChild('reportageEngagement') reportageEngagement?: EventMediaEngagementComponent;
  @ViewChild('interviewEngagement') interviewEngagement?: EventMediaEngagementComponent;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly eventMediaService: EventMediaService,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter(): void {
    this.eventId = resolveRouteParam(this.route, 'id');
    void this.load();
  }

  async ionViewCanLeave(): Promise<boolean> {
    const missing = this.missingEngagementItems();
    if (!missing.length) {
      return true;
    }

    const alert = await this.alertCtrl.create({
      header: 'Participacao incompleta',
      message:
        `Antes de sair, falta informar: ${missing.join(', ')}. ` +
        'Deseja voltar para completar ou sair mesmo assim?',
      buttons: [
        { text: 'Sair mesmo assim', role: 'confirm' },
        { text: 'Voltar', role: 'cancel' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  onSectionChange(value: JournalSection): void {
    this.activeSection = value;
    this.cdr.markForCheck();
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

  private missingEngagementItems(): string[] {
    if (!this.dashboard?.cloudAvailable) return [];

    const isReportage = this.activeSection === 'reportage';
    const item = isReportage ? this.dashboard.journalReportage : this.dashboard.journalInterview;
    if (!item) return [];

    const engagement = isReportage ? this.reportageEngagement : this.interviewEngagement;
    const missing: string[] = [];
    if (!engagement?.hasMyReaction()) missing.push('reacao');
    if (!engagement?.hasMyComment()) missing.push('comentario');
    return missing;
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
        'Nao foi possivel carregar o jornal do evento.'
      );
      this.dashboard = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}

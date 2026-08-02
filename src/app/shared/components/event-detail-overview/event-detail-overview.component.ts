import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export interface EventDetailOverviewChip {
  label: string;
  color: string;
}

export interface EventDetailOverviewRow {
  icon: string;
  title: string;
  value: string;
  detail?: string;
  detailLines?: string[];
}

export interface EventDetailOverviewViewModel {
  name: string;
  typeLabel: string;
  peladaName?: string;
  chips: EventDetailOverviewChip[];
  rows: EventDetailOverviewRow[];
  pixKeys: string[];
  adminApelido?: string;
  adminName: string;
  adminAvatarUrl?: string;
}

@Component({
  selector: 'app-event-detail-overview',
  templateUrl: './event-detail-overview.component.html',
  styleUrls: ['./event-detail-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventDetailOverviewComponent {
  @Input({ required: true }) viewModel!: EventDetailOverviewViewModel;
  @Input() showArrivalOrder = false;
}

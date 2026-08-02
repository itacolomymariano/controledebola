import { PeladaEvent, getEffectiveVotingWindow, getVotingStatusLabel } from '../models/event.model';
import { EventService } from '../services/event.service';
import {
  EventDetailOverviewChip,
  EventDetailOverviewRow,
  EventDetailOverviewViewModel,
} from '../../shared/components/event-detail-overview/event-detail-overview.component';

import { EventRegistration } from '../models/event-registration.model';
import { isContractHiredRegistration } from './registration-hiring.util';

export function registrationCardTitle(registration: EventRegistration): string {
  if (registration.profilePresentationStatus === 'pending') {
    return 'Aguardando aprovacao do administrador';
  }
  if (registration.profilePresentationStatus === 'rejected') {
    return 'Solicitacao recusada';
  }
  if (!registration.isEffectivelyConfirmed) {
    return 'Inscricao pendente';
  }
  if (isContractHiredRegistration(registration)) {
    return 'Contratacao confirmada';
  }
  return 'Participacao confirmada';
}

export function registrationCardColor(registration: EventRegistration): string {
  if (
    registration.profilePresentationStatus === 'pending' ||
    registration.profilePresentationStatus === 'rejected'
  ) {
    return 'warning';
  }
  return registration.isEffectivelyConfirmed ? 'success' : 'warning';
}

export function buildEventDetailOverviewViewModel(
  event: PeladaEvent,
  eventService: EventService,
  options: {
    registrationsOpen: boolean;
    registrationStatusLabel: string;
    supportsArrivalOrder: boolean;
    pixKeys: string[];
  }
): EventDetailOverviewViewModel {
  const chips: EventDetailOverviewChip[] = [];

  if (event.isReadOnly) {
    chips.push({ label: 'Somente leitura', color: 'medium' });
  }
  if (event.isFinished) {
    chips.push({ label: 'Evento encerrado', color: 'dark' });
  }
  chips.push({
    label: options.registrationStatusLabel,
    color: options.registrationsOpen ? 'success' : 'warning',
  });

  const rows: EventDetailOverviewRow[] = [
    {
      icon: 'calendar-outline',
      title: 'Inicio',
      value: formatEventDate(event.startTime),
    },
    {
      icon: 'time-outline',
      title: 'Termino',
      value: formatEventDate(event.endTime),
    },
    {
      icon: 'ticket-outline',
      title: 'Inscricoes abertas',
      value: formatEventDate(event.registrationOpensAt),
    },
    {
      icon: 'ticket-outline',
      title: 'Inscricoes encerradas',
      value: formatEventDate(event.registrationClosesAt),
    },
  ];

  if (options.supportsArrivalOrder && event.useArrivalOrderForTeams) {
    rows.push({
      icon: 'walk-outline',
      title: 'Formacao de times',
      value: 'Ordem de chegada dos atletas',
    });
  }

  rows.push({
    icon: 'location-outline',
    title: 'Local',
    value: eventService.formatAddress(event.address),
    detail: event.locationComplement ? `Complemento: ${event.locationComplement}` : undefined,
    detailLines: [`CEP ${event.address.zipCode}`],
  });

  rows.push({
    icon: 'cash-outline',
    title: 'Valor da participacao',
    value: eventService.formatParticipationFee(event.participationFee),
  });

  return {
    name: event.name,
    typeLabel: eventService.formatType(event.type),
    peladaName: event.peladaName,
    chips,
    rows,
    pixKeys: options.pixKeys,
    adminApelido: event.adminApelido,
    adminName: event.adminName,
    adminAvatarUrl: event.adminAvatarUrl,
  };
}

export function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function buildEventVotingPeriodLabels(event: PeladaEvent): {
  opensAt: string;
  closesAt: string;
  statusLabel: string;
  usesDefault: boolean;
} | null {
  const window = getEffectiveVotingWindow(event);
  return {
    opensAt: formatEventDate(window.opensAt),
    closesAt: formatEventDate(window.closesAt),
    statusLabel: getVotingStatusLabel(event),
    usesDefault: window.usesDefault,
  };
}

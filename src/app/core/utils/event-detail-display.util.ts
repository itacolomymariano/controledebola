import { AppLocale } from '../models/app-locale.model';
import { PeladaEvent, getEffectiveVotingWindow } from '../models/event.model';
import { EventService } from '../services/event.service';
import {
  EventDetailOverviewChip,
  EventDetailOverviewRow,
  EventDetailOverviewViewModel,
} from '../../shared/components/event-detail-overview/event-detail-overview.component';

import { EventRegistration } from '../models/event-registration.model';
import { formatAppDateTime } from './locale-datetime.util';
import { isContractHiredRegistration } from './registration-hiring.util';
import { localizedVotingStatusLabel } from './event-status-i18n.util';
import { I18nService } from '../services/i18n.service';

export type I18nTranslate = (key: string, params?: Record<string, string | number>) => string;

export function registrationCardTitle(
  registration: EventRegistration,
  t: I18nTranslate
): string {
  if (registration.profilePresentationStatus === 'pending') {
    return t('eventDetail.registrationCard.awaitingAdmin');
  }
  if (registration.profilePresentationStatus === 'rejected') {
    return t('eventDetail.registrationCard.rejected');
  }
  if (!registration.isEffectivelyConfirmed) {
    return t('eventDetail.registrationCard.pending');
  }
  if (isContractHiredRegistration(registration)) {
    return t('eventDetail.registrationCard.hiringConfirmed');
  }
  return t('eventDetail.registrationCard.confirmed');
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
    t: I18nTranslate;
    locale: AppLocale;
  }
): EventDetailOverviewViewModel {
  const { t, locale } = options;
  const chips: EventDetailOverviewChip[] = [];

  if (event.isReadOnly) {
    chips.push({ label: t('eventDetail.overview.readOnly'), color: 'medium' });
  }
  if (event.isFinished) {
    chips.push({ label: t('eventDetail.overview.finished'), color: 'dark' });
  }
  chips.push({
    label: options.registrationStatusLabel,
    color: options.registrationsOpen ? 'success' : 'warning',
  });

  const fmt = (date: Date) => formatAppDateTime(date, locale);

  const rows: EventDetailOverviewRow[] = [
    {
      icon: 'calendar-outline',
      title: t('eventDetail.overview.start'),
      value: fmt(event.startTime),
    },
    {
      icon: 'time-outline',
      title: t('eventDetail.overview.end'),
      value: fmt(event.endTime),
    },
    {
      icon: 'ticket-outline',
      title: t('eventDetail.overview.registrationOpen'),
      value: fmt(event.registrationOpensAt),
    },
    {
      icon: 'ticket-outline',
      title: t('eventDetail.overview.registrationClose'),
      value: fmt(event.registrationClosesAt),
    },
  ];

  if (event.type === 'team_match' && (event.homeTeamName || event.awayTeamName)) {
    rows.push({
      icon: 'football-outline',
      title: t('eventDetail.overview.fixture'),
      value: '',
      teamMatch: {
        homeTeamName: event.homeTeamName || t('eventDetail.teamMatch.sideHomeFallback'),
        awayTeamName: event.awayTeamName || t('eventDetail.teamMatch.sideAwayFallback'),
        homeTeamShieldUrl: event.homeTeamShieldUrl,
        awayTeamShieldUrl: event.awayTeamShieldUrl,
      },
    });
  }

  if (options.supportsArrivalOrder && event.useArrivalOrderForTeams) {
    rows.push({
      icon: 'walk-outline',
      title: t('eventDetail.overview.teamFormation'),
      value: t('eventDetail.overview.arrivalOrder'),
    });
  }

  rows.push({
    icon: 'location-outline',
    title: t('eventDetail.overview.venue'),
    value: eventService.formatAddress(event.address),
    detail: event.locationComplement
      ? t('eventDetail.overview.locationComplement', { text: event.locationComplement })
      : undefined,
    detailLines: [t('eventDetail.overview.zipLine', { zip: event.address.zipCode })],
  });

  rows.push({
    icon: 'cash-outline',
    title: t('eventDetail.overview.participationFee'),
    value: eventService.formatParticipationFee(event.participationFee),
  });

  const adminApelido = event.adminApelido?.trim() || '';
  const storedAdminName = event.adminName?.trim() || '';
  const isAdminFallback =
    !adminApelido &&
    (!storedAdminName ||
      storedAdminName === 'Administrador' ||
      storedAdminName === 'Administrator');
  const adminName = adminApelido || (isAdminFallback ? t('common.adminFallback') : storedAdminName);

  return {
    name: event.name,
    typeLabel: eventService.formatType(event.type),
    peladaName: event.peladaName,
    chips,
    rows,
    pixKeys: options.pixKeys,
    adminApelido,
    adminName,
    adminAvatarUrl: event.adminAvatarUrl,
  };
}

/** @deprecated Use formatAppDateTime with locale */
export function formatEventDate(date: Date, locale: AppLocale = 'pt-BR'): string {
  return formatAppDateTime(date, locale);
}

export function buildEventVotingPeriodLabels(
  event: PeladaEvent,
  i18n: I18nService
): {
  opensAt: string;
  closesAt: string;
  statusLabel: string;
  usesDefault: boolean;
} | null {
  const window = getEffectiveVotingWindow(event);
  return {
    opensAt: formatAppDateTime(window.opensAt, i18n.locale),
    closesAt: formatAppDateTime(window.closesAt, i18n.locale),
    statusLabel: localizedVotingStatusLabel(i18n, event),
    usesDefault: window.usesDefault,
  };
}
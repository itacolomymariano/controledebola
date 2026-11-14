import { getEffectiveVotingWindow, RegistrationStatus } from '../models/event.model';
import { I18nService } from '../services/i18n.service';

export function registrationStatusI18nKey(status: RegistrationStatus): string {
  switch (status) {
    case 'open':
      return 'event.registration.status.open';
    case 'closed':
      return 'event.registration.status.closed';
    case 'not_yet_open':
      return 'event.registration.status.soon';
  }
}

export function localizedRegistrationStatusLabel(i18n: I18nService, status: RegistrationStatus): string {
  return i18n.t(registrationStatusI18nKey(status));
}

export function votingStatusI18nKey(
  event: Pick<{ startTime: Date; votingOpensAt?: Date | null; votingClosesAt?: Date | null }, 'startTime' | 'votingOpensAt' | 'votingClosesAt'>,
  now = new Date()
): string {
  const { opensAt, closesAt } = getEffectiveVotingWindow({
    startTime: event.startTime,
    votingOpensAt: event.votingOpensAt ?? undefined,
    votingClosesAt: event.votingClosesAt ?? undefined,
  });
  if (now < opensAt) return 'event.voting.status.soon';
  if (now >= closesAt) return 'event.voting.status.closed';
  return 'event.voting.status.open';
}

export function localizedVotingStatusLabel(
  i18n: I18nService,
  event: Pick<{ startTime: Date; votingOpensAt?: Date | null; votingClosesAt?: Date | null }, 'startTime' | 'votingOpensAt' | 'votingClosesAt'>,
  now = new Date()
): string {
  return i18n.t(votingStatusI18nKey(event, now));
}
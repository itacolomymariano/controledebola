import { Address } from './address.model';

export type EventType = 'pelada' | 'racha' | 'team_match';

export type RegistrationStatus = 'open' | 'closed' | 'not_yet_open';

export interface PeladaEvent {
  objectId: string;
  peladaId?: string;
  peladaName?: string;
  name: string;
  type: EventType;
  startTime: Date;
  endTime: Date;
  address: Address;
  locationComplement: string;
  adminId: string;
  adminName: string;
  adminApelido?: string;
  adminAvatarUrl?: string;
  readOnlyAt: Date;
  isReadOnly: boolean;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  useArrivalOrderForTeams: boolean;
  participationFee: number;
  pixKey1: string;
  pixKey2: string;
  pixKey3: string;
  homeTeamName?: string;
  awayTeamName?: string;
  isFinished: boolean;
  votingOpensAt?: Date;
  votingClosesAt?: Date;
  sumulaOpensAt?: Date;
  sumulaClosesAt?: Date;
  scoutApontamentoOpensAt?: Date;
  scoutApontamentoClosesAt?: Date;
  gateTicketControlEnabled?: boolean;
  maxAthletesPerEvent?: number;
  /** Copiado da pelada ao carregar o evento. */
  allowTeamSplitAfterEventEnd?: boolean;
}

export interface PeladaEventListItem extends PeladaEvent {
  memberBadge?: boolean;
  isRegistered?: boolean;
  isPast?: boolean;
  registrationStatusLabel?: string;
  nearby?: boolean;
  maxAthletes?: number;
  confirmedAthletes?: number;
  remainingAthleteSpots?: number | null;
}

export interface CreateEventPayload {
  peladaId: string;
  name: string;
  type: EventType;
  startTime: Date;
  endTime: Date;
  address: Address;
  locationComplement?: string;
  registrationOpensAt?: Date;
  registrationClosesAt?: Date;
  useArrivalOrderForTeams?: boolean;
  participationFee?: number;
  pixKey1?: string;
  pixKey2?: string;
  pixKey3?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  gateTicketControlEnabled?: boolean;
}

export interface EffectiveConfirmationOptions {
  invitedByContract?: boolean;
  invitedAsReferee?: boolean;
  isAnonymous?: boolean;
  profilePresentationStatus?: 'pending' | 'approved' | 'rejected' | null;
}

export function computeEffectiveConfirmation(
  participationFee: number,
  paymentConfirmed: boolean,
  paymentExempt = false,
  options?: EffectiveConfirmationOptions
): boolean {
  if (
    options?.profilePresentationStatus === 'pending' ||
    options?.profilePresentationStatus === 'rejected'
  ) {
    return false;
  }
  if (options?.invitedByContract || options?.invitedAsReferee || options?.isAnonymous) {
    return true;
  }
  if (participationFee <= 0) return true;
  if (paymentExempt) return true;
  return paymentConfirmed;
}

export function hasPixKey(pixKey1?: string, pixKey2?: string, pixKey3?: string): boolean {
  return [pixKey1, pixKey2, pixKey3].some((key) => !!key?.trim());
}

export function hasPositiveParticipationFee(fee: number | string | null | undefined): boolean {
  const value = Number(fee);
  return Number.isFinite(value) && value > 0;
}

export interface UpdateEventAdminPayload {
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  useArrivalOrderForTeams: boolean;
  isFinished?: boolean;
  votingOpensAt?: Date | null;
  votingClosesAt?: Date | null;
  sumulaOpensAt?: Date | null;
  sumulaClosesAt?: Date | null;
  scoutApontamentoOpensAt?: Date | null;
  scoutApontamentoClosesAt?: Date | null;
  gateTicketControlEnabled?: boolean;
  maxAthletesPerEvent?: number;
  participationFee?: number;
  pixKey1?: string;
  pixKey2?: string;
  pixKey3?: string;
}

export interface EventSearchFilters {
  query?: string;
  city?: string;
  type?: EventType;
}

export interface EventLocationConflict {
  eventId: string;
  eventName: string;
  startTime: Date;
  endTime: Date;
  locationComplement: string;
}

export function normalizeLocationComplement(value: string | undefined | null): string {
  return value?.trim().toLowerCase() ?? '';
}

export function isSameLocationComplement(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  return normalizeLocationComplement(a) === normalizeLocationComplement(b);
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  pelada: 'Pelada',
  racha: 'Racha',
  team_match: 'Jogo entre equipes',
};

export const READ_ONLY_HOURS_AFTER_END = 2;

export function computeReadOnlyAt(endTime: Date): Date {
  return new Date(endTime.getTime() + READ_ONLY_HOURS_AFTER_END * 60 * 60 * 1000);
}

export function isEventReadOnly(endTime: Date, now = new Date()): boolean {
  return now >= computeReadOnlyAt(endTime);
}

export function isEventPast(endTime: Date, now = new Date()): boolean {
  return endTime < now;
}

export function eventsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && startB < endA;
}

export function getRegistrationStatus(
  registrationOpensAt: Date,
  registrationClosesAt: Date,
  now = new Date()
): RegistrationStatus {
  if (now < registrationOpensAt) return 'not_yet_open';
  if (now >= registrationClosesAt) return 'closed';
  return 'open';
}

export function getRegistrationStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case 'open':
      return 'Inscricoes abertas';
    case 'closed':
      return 'Inscricoes encerradas';
    case 'not_yet_open':
      return 'Inscricoes em breve';
  }
}

export function supportsArrivalOrder(type: EventType): boolean {
  return type === 'pelada' || type === 'racha';
}

const VOTING_DEFAULT_HOURS = 24;

export function getEffectiveVotingWindow(
  event: Pick<PeladaEvent, 'startTime' | 'votingOpensAt' | 'votingClosesAt'>
): { opensAt: Date; closesAt: Date; usesDefault: boolean } {
  const usesDefault = !event.votingOpensAt && !event.votingClosesAt;
  const opensAt = event.votingOpensAt ?? event.startTime;
  const closesAt =
    event.votingClosesAt ??
    new Date(event.startTime.getTime() + VOTING_DEFAULT_HOURS * 60 * 60 * 1000);
  return { opensAt, closesAt, usesDefault };
}

export function isVotingOpen(
  event: Pick<PeladaEvent, 'startTime' | 'votingOpensAt' | 'votingClosesAt'>,
  now = new Date()
): boolean {
  const { opensAt, closesAt } = getEffectiveVotingWindow(event);
  return now >= opensAt && now < closesAt;
}

export function getVotingStatusLabel(
  event: Pick<PeladaEvent, 'startTime' | 'votingOpensAt' | 'votingClosesAt'>,
  now = new Date()
): string {
  const { opensAt, closesAt } = getEffectiveVotingWindow(event);
  if (now < opensAt) return 'Votacao em breve';
  if (now >= closesAt) return 'Votacao encerrada';
  return 'Votacao aberta';
}

export function isEventEnded(
  event: Pick<PeladaEvent, 'isFinished' | 'endTime'>,
  now = new Date()
): boolean {
  return !!event.isFinished || event.endTime < now;
}

/** Edicao de sumula pelo juiz dentro do periodo configurado e com evento ainda nao encerrado. */
export function isSumulaEditOpen(
  event: Pick<PeladaEvent, 'sumulaOpensAt' | 'sumulaClosesAt' | 'isFinished' | 'endTime'>,
  now = new Date()
): boolean {
  if (isEventEnded(event, now)) return false;
  const opensAt = event.sumulaOpensAt;
  const closesAt = event.sumulaClosesAt;
  if (!opensAt && !closesAt) return true;
  if (opensAt && now < opensAt) return false;
  if (closesAt && now > closesAt) return false;
  return true;
}

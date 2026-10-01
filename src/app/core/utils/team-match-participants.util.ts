import { EventRegistrationListItem } from '../models/event-registration.model';
import { TeamSide } from '../models/event.model';

const sideRank = (side?: TeamSide): number =>
  side === 'home' ? 0 : side === 'away' ? 1 : 2;

export function sortTeamMatchParticipants(
  rows: EventRegistrationListItem[]
): EventRegistrationListItem[] {
  return [...rows].sort((a, b) => {
    const sideDiff = sideRank(a.teamSide) - sideRank(b.teamSide);
    if (sideDiff !== 0) return sideDiff;
    return String(a.apelido || a.userName || '').localeCompare(
      String(b.apelido || b.userName || ''),
      'pt-BR'
    );
  });
}

export interface TeamMatchParticipantGroup {
  key: 'home' | 'away' | 'none';
  title: string;
  participants: EventRegistrationListItem[];
}

export function groupTeamMatchParticipants(
  rows: EventRegistrationListItem[],
  homeTeamName?: string,
  awayTeamName?: string
): TeamMatchParticipantGroup[] {
  const sorted = sortTeamMatchParticipants(rows);
  const home: EventRegistrationListItem[] = [];
  const away: EventRegistrationListItem[] = [];
  const none: EventRegistrationListItem[] = [];
  for (const row of sorted) {
    if (row.teamSide === 'home') home.push(row);
    else if (row.teamSide === 'away') away.push(row);
    else none.push(row);
  }
  const groups: TeamMatchParticipantGroup[] = [];
  if (home.length) {
    groups.push({
      key: 'home',
      title: homeTeamName?.trim() || 'Mandante',
      participants: home,
    });
  }
  if (away.length) {
    groups.push({
      key: 'away',
      title: awayTeamName?.trim() || 'Visitante',
      participants: away,
    });
  }
  if (none.length) {
    groups.push({ key: 'none', title: 'Sem time definido', participants: none });
  }
  return groups;
}

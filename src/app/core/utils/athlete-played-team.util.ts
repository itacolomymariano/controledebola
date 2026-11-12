import { AthletePlayedTeamLink, AthletePlayedTeamPick } from '../models/athlete-played-team.model';
import { AthleteProfile } from '../models/athlete-profile.model';
import { AthletePublicProfile } from '../models/athlete-search.model';

function linkKey(link: Pick<AthletePlayedTeamLink, 'kind' | 'teamId' | 'label'>): string {
  if (link.teamId) return `${link.kind}:${link.teamId}`;
  return `${link.kind}:${link.label.toLowerCase()}`;
}

export function playedTeamLinksFromAthleteProfile(profile: AthleteProfile): AthletePlayedTeamLink[] {
  if (profile.playedTeamLinks?.length) return [...profile.playedTeamLinks];
  return (profile.playedAmateurTeams ?? []).map((label) => ({
    kind: 'legend',
    teamId: '',
    label,
    source: 'manual',
  }));
}

export function playedTeamLinksFromPublicProfile(profile: AthletePublicProfile): AthletePlayedTeamLink[] {
  if (profile.teamLinks?.length) return [...profile.teamLinks];
  return (profile.teams ?? []).map((label) => ({
    kind: 'legend',
    teamId: '',
    label,
    source: 'manual',
  }));
}

export function teamNamesFromLinks(links: AthletePlayedTeamLink[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const label = link.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(label);
  }
  return names;
}

export function addPlayedTeamPick(
  links: AthletePlayedTeamLink[],
  pick: AthletePlayedTeamPick | string
): AthletePlayedTeamLink[] {
  if (typeof pick === 'string') {
    const label = pick.trim();
    if (!label) return links;
    const key = `legend:${label.toLowerCase()}`;
    if (links.some((link) => linkKey(link) === key)) return links;
    return [...links, { kind: 'legend', teamId: '', label, source: 'manual' }];
  }

  const label = pick.name.trim();
  if (!label) return links;
  const next: AthletePlayedTeamLink = {
    kind: pick.kind,
    teamId: pick.id,
    label,
    source: pick.id ? 'self' : 'manual',
    imageUrl: pick.imageUrl,
  };
  const key = linkKey(next);
  if (links.some((link) => linkKey(link) === key)) return links;
  return [...links, next];
}

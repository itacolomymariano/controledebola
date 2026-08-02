import { TEAM_SHIELD_SEARCH_ALIASES } from '../data/team-shield-aliases.data';
import { teamSlug } from './team-shield.util';

const SPORTSDB_API = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php';

interface SportsDbTeam {
  strTeam?: string;
  strTeamAlternate?: string;
  strCountry?: string;
  strLeague?: string;
  strLeague2?: string;
  strLeague3?: string;
  strLeague4?: string;
  strBadge?: string;
  strTeamBadge?: string;
}

function isBrazilianTeam(team: SportsDbTeam): boolean {
  const country = String(team.strCountry || '').toLowerCase();
  if (country === 'brazil') return true;

  const leagues = [team.strLeague, team.strLeague2, team.strLeague3, team.strLeague4]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  return (
    leagues.includes('brazil') ||
    leagues.includes('brasileir') ||
    leagues.includes('serie') ||
    leagues.includes('copa do brasil') ||
    leagues.includes('campeonato')
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreSportsDbMatch(team: SportsDbTeam, queries: string[]): number {
  let score = 0;
  if (isBrazilianTeam(team)) score += 100;

  const names = [team.strTeam, team.strTeamAlternate]
    .map((value) => normalizeSearchText(String(value || '')))
    .filter(Boolean);

  for (const query of queries) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) continue;

    for (const name of names) {
      if (name === normalizedQuery) score += 60;
      else if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) score += 25;
      else {
        const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 2);
        const matchedTokens = queryTokens.filter((token) => name.includes(token));
        score += matchedTokens.length * 8;
      }
    }
  }

  if (team.strBadge || team.strTeamBadge) score += 5;
  return score;
}

export function buildTeamShieldSearchQueries(teamName: string, slug?: string): string[] {
  const resolvedSlug = slug || teamSlug(teamName);
  const aliases = TEAM_SHIELD_SEARCH_ALIASES[resolvedSlug] || [];
  const fromSlug = resolvedSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  const queries = [
    teamName,
    ...aliases,
    fromSlug,
    `${teamName} FC`,
    `${teamName} Esporte Clube`,
    `${teamName} Futebol Clube`,
  ];

  const seen = new Set<string>();
  return queries
    .map((query) => query.trim())
    .filter(Boolean)
    .filter((query) => {
      const key = normalizeSearchText(query);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function searchSportsDbTeams(query: string): Promise<SportsDbTeam[]> {
  const response = await fetch(`${SPORTSDB_API}?t=${encodeURIComponent(query)}`);
  if (!response.ok) return [];

  const body = (await response.json()) as { teams?: SportsDbTeam[] | null };
  return Array.isArray(body.teams) ? body.teams : [];
}

export async function resolveTeamShieldFromSportsDb(
  teamName: string,
  slug?: string
): Promise<string | null> {
  const queries = buildTeamShieldSearchQueries(teamName, slug);
  const candidates = new Map<string, { team: SportsDbTeam; score: number }>();

  for (const query of queries) {
    const teams = await searchSportsDbTeams(query);
    for (const team of teams) {
      const score = scoreSportsDbMatch(team, queries);
      if (score < 30) continue;
      const key = String(team.strTeam || '') + '|' + String(team.strCountry || '');
      const previous = candidates.get(key);
      if (!previous || score > previous.score) {
        candidates.set(key, { team, score });
      }
    }
  }

  const ranked = Array.from(candidates.values()).sort((a, b) => b.score - a.score);
  const best = ranked.find((entry) => isBrazilianTeam(entry.team)) || ranked[0];
  if (!best) return null;

  const badge = best.team.strBadge || best.team.strTeamBadge;
  return badge ? String(badge) : null;
}

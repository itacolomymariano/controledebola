import { BrazilianTeamOption } from '../data/brazilian-teams.data';
import { TEAM_SHIELD_FILES } from '../data/team-shield-files.data';

export function teamSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function shieldUrlFromFile(file: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=64`;
}

export function nameToUnderscore(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function buildTeamShieldFileCandidates(
  team: Pick<BrazilianTeamOption, 'name' | 'slug'>
): string[] {
  const slug = team.slug || teamSlug(team.name);
  const underscore = nameToUnderscore(team.name);
  const slugUnderscore = slug.replace(/-/g, '_');

  return [
    `${underscore}_logo.svg`,
    `${underscore}_FC_logo.svg`,
    `${underscore}_FC_(logo).svg`,
    `Escudo_do_${underscore}.svg`,
    `Escudo_${underscore}.svg`,
    `${slugUnderscore}_logo.svg`,
    `${slugUnderscore}_FC_logo.svg`,
    `Logo_${underscore}.svg`,
    `Logotipo_${underscore}.svg`,
    `${underscore}_logo.png`,
    `${underscore}_FC_logo.png`,
  ];
}

export function getTeamShieldCandidates(
  team: Pick<BrazilianTeamOption, 'name' | 'slug'>
): string[] {
  const slug = team.slug || teamSlug(team.name);
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addFile = (file: string) => {
    const url = shieldUrlFromFile(file);
    if (!seen.has(url)) {
      seen.add(url);
      candidates.push(url);
    }
  };

  const entry = TEAM_SHIELD_FILES[slug];
  if (entry) {
    const files = Array.isArray(entry) ? entry : [entry];
    files.forEach(addFile);
  }

  for (const file of buildTeamShieldFileCandidates(team)) {
    addFile(file);
  }

  return candidates;
}

export function getTeamShieldUrl(
  team: Pick<BrazilianTeamOption, 'name' | 'slug'>
): string | undefined {
  return getTeamShieldCandidates(team)[0];
}

export function teamInitials(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

import { buildTeamShieldFileCandidates, nameToUnderscore, teamSlug } from './team-shield.util';
import { buildTeamShieldSearchQueries } from './team-shield-remote.util';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

export async function fetchCommonsShieldThumb(fileName: string): Promise<string | null> {
  const title = fileName.startsWith('File:') ? fileName : `File:${fileName}`;
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '64',
    format: 'json',
    origin: '*',
  });

  try {
    const response = await fetch(`${COMMONS_API}?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          { missing?: string; imageinfo?: { thumburl?: string; url?: string }[] }
        >;
      };
    };
    const page = Object.values(data.query?.pages ?? {})[0];
    if (!page || page.missing) return null;
    const info = page.imageinfo?.[0];
    return info?.thumburl || info?.url || null;
  } catch {
    return null;
  }
}

async function searchCommonsShieldFile(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `${query} logo escudo brasileiro futebol`,
    srnamespace: '6',
    srlimit: '5',
    format: 'json',
    origin: '*',
  });

  try {
    const response = await fetch(`${COMMONS_API}?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      query?: { search?: { title?: string }[] };
    };
    const results = data.query?.search ?? [];
    for (const result of results) {
      const title = String(result.title || '');
      if (!title.startsWith('File:')) continue;
      const fileName = title.replace(/^File:/, '');
      const lower = fileName.toLowerCase();
      if (
        lower.includes('old') ||
        lower.includes('antigo') ||
        lower.includes('histor') ||
        lower.includes('.pdf')
      ) {
        continue;
      }
      const thumb = await fetchCommonsShieldThumb(fileName);
      if (thumb) return thumb;
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveTeamShieldFromCommons(
  teamName: string,
  slug?: string
): Promise<string | null> {
  const resolvedSlug = slug || teamSlug(teamName);
  const underscore = nameToUnderscore(teamName);
  const slugUnderscore = resolvedSlug.replace(/-/g, '_');
  const fileCandidates = [
    ...buildTeamShieldFileCandidates({ name: teamName, slug: resolvedSlug }).map((url) => {
      const match = url.match(/Special:FilePath\/([^?]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    }),
    `${underscore}_logo.svg`,
    `${underscore}_FC_logo.svg`,
    `Escudo_do_${underscore}.svg`,
    `${slugUnderscore}_logo.svg`,
    `${underscore}_logo.png`,
  ].filter(Boolean);

  const seenFiles = new Set<string>();
  for (const file of fileCandidates) {
    if (seenFiles.has(file)) continue;
    seenFiles.add(file);
    const thumb = await fetchCommonsShieldThumb(file);
    if (thumb) return thumb;
  }

  const searchQueries = buildTeamShieldSearchQueries(teamName, resolvedSlug).slice(0, 4);
  for (const query of searchQueries) {
    const thumb = await searchCommonsShieldFile(query);
    if (thumb) return thumb;
  }

  return null;
}

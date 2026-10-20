export type FooterTabKey = 'peladas' | 'search' | 'events' | 'mural' | 'profile';

/** Normalizes router URL for footer tab matching (no query/hash). */
export function normalizeFooterUrl(url: string): string {
  const path = url.split('?')[0]?.split('#')[0] ?? url;
  return path.replace(/\/+$/, '') || '/';
}

export function isFooterTabActive(url: string, key: FooterTabKey): boolean {
  const path = normalizeFooterUrl(url);

  switch (key) {
    case 'peladas':
      return path === '/tabs/peladas/lista' || path.startsWith('/tabs/peladas/lista/');
    case 'search':
      return path === '/tabs/search' || path.startsWith('/tabs/search/');
    case 'events':
      return path === '/tabs/events' || path.startsWith('/tabs/events/');
    case 'mural':
      return path === '/tabs/mural' || path.startsWith('/tabs/mural/');
    case 'profile':
      return path === '/tabs/profile' || path.startsWith('/tabs/profile/');
    default:
      return false;
  }
}

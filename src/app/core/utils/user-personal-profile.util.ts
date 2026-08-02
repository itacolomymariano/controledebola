import Parse from 'parse';

export function readUserFavoriteProTeam(
  user: Parse.User | null | undefined,
  ...legacyValues: Array<string | null | undefined>
): string | undefined {
  const fromUser = (user?.get('favoriteProTeam') as string | undefined)?.trim();
  if (fromUser) return fromUser;
  for (const legacy of legacyValues) {
    const value = legacy?.trim();
    if (value) return value;
  }
  return undefined;
}

export function readUserFavoriteAmateurTeam(
  user: Parse.User | null | undefined,
  ...legacyValues: Array<string | null | undefined>
): string | undefined {
  const fromUser = (user?.get('favoriteAmateurTeam') as string | undefined)?.trim();
  if (fromUser) return fromUser;
  for (const legacy of legacyValues) {
    const value = legacy?.trim();
    if (value) return value;
  }
  return undefined;
}

export function readUserProFootballIdol(user: Parse.User | null | undefined): string | undefined {
  return (user?.get('proFootballIdol') as string | undefined)?.trim() || undefined;
}

export function readUserAmateurFootballIdol(user: Parse.User | null | undefined): string | undefined {
  return (user?.get('amateurFootballIdol') as string | undefined)?.trim() || undefined;
}

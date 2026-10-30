import Parse from 'parse';
import { environment } from '../../../environments/environment';
import { ParseFileService } from '../services/parse-file.service';

/** Ignora avatarUrl copiado de outro app Back4App (ex.: clone pos-backup). */
export function isParseHostedAvatarUrlForCurrentApp(url: string): boolean {
  const appId = environment.parse?.appId?.trim();
  if (!appId || appId.includes('COLE_SEU')) {
    return true;
  }

  const lower = url.toLowerCase();
  const isBack4AppFiles =
    lower.includes('parsefiles.back4app.com') ||
    lower.includes('b4a.io/') ||
    lower.includes('back4app.com/');
  if (!isBack4AppFiles) {
    return true;
  }

  return url.includes(appId);
}

export function getUserAvatarUrl(
  user: Parse.User | null | undefined,
  parseFileService: ParseFileService
): string | null {
  if (!user) return null;

  const avatar = user.get('avatar') as Parse.File | { url?: string; _url?: string } | string | undefined;
  const fromFile = parseFileService.getFileUrl(avatar);
  if (fromFile?.trim()) {
    return fromFile.trim();
  }

  const directUrl = (user.get('avatarUrl') as string | undefined)?.trim();
  if (!directUrl) return null;
  if (!isParseHostedAvatarUrlForCurrentApp(directUrl)) {
    return null;
  }
  return directUrl;
}

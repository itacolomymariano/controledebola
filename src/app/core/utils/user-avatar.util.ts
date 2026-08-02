import Parse from 'parse';
import { ParseFileService } from '../services/parse-file.service';

export function getUserAvatarUrl(
  user: Parse.User | null | undefined,
  parseFileService: ParseFileService
): string | null {
  if (!user) return null;

  const directUrl = user.get('avatarUrl') as string | undefined;
  if (directUrl?.trim()) return directUrl.trim();

  const avatar = user.get('avatar') as Parse.File | { url?: string; _url?: string } | string | undefined;
  return parseFileService.getFileUrl(avatar);
}

import Parse from 'parse';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { ParseFileService } from '../services/parse-file.service';

export interface MemberDisplayFields {
  apelido?: string;
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
}

export function applyMemberDisplayFields(
  membership: Parse.Object,
  user: Parse.User,
  parseFileService: ParseFileService,
  hints?: MemberDisplayFields
): void {
  const apelido = hints?.apelido?.trim() || ((user.get('apelido') as string) || '').trim();
  const fullName = hints?.fullName?.trim() || ((user.get('name') as string) || '').trim();
  const displayName =
    hints?.displayName?.trim() || apelido || fullName || user.getUsername() || 'Socio';
  const avatarUrl =
    hints?.avatarUrl?.trim() || getUserAvatarUrl(user, parseFileService) || undefined;

  membership.set('memberApelido', apelido);
  membership.set('memberFullName', fullName);
  membership.set('memberDisplayName', displayName);
  if (user.id) {
    membership.set('memberUserId', user.id);
  }
  if (avatarUrl) {
    membership.set('memberAvatarUrl', avatarUrl);
  }
}

export function membershipDisplayFromObject(
  obj: Parse.Object,
  user: Parse.User | undefined,
  parseFileService: ParseFileService
): MemberDisplayFields & { userId: string } {
  const apelido =
    (obj.get('memberApelido') as string | undefined)?.trim() ||
    (user?.get('apelido') as string) ||
    '';
  const fullName =
    (obj.get('memberFullName') as string | undefined)?.trim() ||
    (user?.get('name') as string) ||
    '';
  const displayName =
    (obj.get('memberDisplayName') as string | undefined)?.trim() ||
    apelido ||
    fullName ||
    (user?.get('apelido') as string) ||
    (user?.get('name') as string) ||
    user?.getUsername() ||
    'Socio';
  const avatarUrl =
    (obj.get('memberAvatarUrl') as string | undefined)?.trim() ||
    getUserAvatarUrl(user, parseFileService) ||
    undefined;

  return {
    userId:
      (obj.get('memberUserId') as string | undefined)?.trim() ||
      user?.id ||
      '',
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    displayName,
    avatarUrl,
  };
}

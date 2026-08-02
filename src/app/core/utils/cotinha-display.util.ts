import Parse from 'parse';
import { getUserAvatarUrl } from './user-avatar.util';
import { ParseFileService } from '../services/parse-file.service';

export interface PayerDisplayFields {
  apelido?: string;
  displayName?: string;
  avatarUrl?: string;
}

export function applyPayerDisplayFields(
  payment: Parse.Object,
  user: Parse.User,
  parseFileService: ParseFileService,
  hints?: PayerDisplayFields
): void {
  const apelido = hints?.apelido?.trim() || ((user.get('apelido') as string) || '').trim();
  const fullName = ((user.get('name') as string) || '').trim();
  const displayName =
    hints?.displayName?.trim() || apelido || fullName || user.getUsername() || 'Participante';
  const avatarUrl =
    hints?.avatarUrl?.trim() || getUserAvatarUrl(user, parseFileService) || undefined;

  if (user.id) {
    payment.set('payerUserId', user.id);
  }
  payment.set('payerApelido', apelido);
  payment.set('payerDisplayName', displayName);
  if (avatarUrl) {
    payment.set('payerAvatarUrl', avatarUrl);
  }
}

export function payerDisplayFromObject(
  obj: Parse.Object,
  user: Parse.User | undefined,
  parseFileService: ParseFileService
): PayerDisplayFields & { userId: string } {
  const apelido =
    (obj.get('payerApelido') as string | undefined)?.trim() ||
    (user?.get('apelido') as string) ||
    '';
  const displayName =
    (obj.get('payerDisplayName') as string | undefined)?.trim() ||
    apelido ||
    (user?.get('name') as string) ||
    user?.getUsername() ||
    'Participante';
  const avatarUrl =
    (obj.get('payerAvatarUrl') as string | undefined)?.trim() ||
    getUserAvatarUrl(user, parseFileService) ||
    undefined;

  return {
    userId:
      (obj.get('payerUserId') as string | undefined)?.trim() ||
      user?.id ||
      '',
    apelido: apelido || undefined,
    displayName,
    avatarUrl,
  };
}

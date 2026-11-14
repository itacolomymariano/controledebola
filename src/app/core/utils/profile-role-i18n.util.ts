import { PROFILE_ROLE_LABELS, ProfileRole } from '../models/profile-role.model';
import { I18nService } from '../services/i18n.service';

export function localizedProfileRoleLabel(i18n: I18nService, role: ProfileRole): string {
  const key = `profileRole.${role}`;
  const v = i18n.t(key);
  return v === key ? PROFILE_ROLE_LABELS[role] : v;
}
import { PROFILE_ROLE_LABELS, ProfileRole } from '../models/profile-role.model';
import { normalizeSearchText } from './search-text.util';

/** Aliases curtos para busca em Negociacao/Contratacoes (ex.: "prep" → Preparador Fisico). */
const ROLE_SEARCH_ALIASES: Partial<Record<ProfileRole, string[]>> = {
  physical_trainer: ['prep', 'preparador', 'pf', 'fisico', 'physical_trainer', 'physical trainer'],
  masseur: ['mass', 'massag', 'massagista', 'masseur'],
  kitman: ['roup', 'rope', 'ropeiro', 'roupeiro', 'kit', 'kitman'],
  coach: ['trein', 'treinador', 'coach', 'tec', 'tecnico'],
  referee: ['juiz', 'arb', 'arbitro', 'referee'],
  scout: ['scout', 'mesario', 'mesa'],
  journalist: ['jornal', 'jornalista', 'imprensa'],
  cameraman: ['cine', 'cinegrafista', 'camera'],
  narrator: ['narr', 'narrador', 'radio'],
  gandula: ['gandula', 'ganda'],
  gatekeeper: ['port', 'porteiro', 'gate'],
  fan: ['torc', 'torcedor', 'fan'],
  athlete: ['atleta', 'jogador'],
};

export function searchMatchesRoleKeyword(search: string, role: ProfileRole): boolean {
  const normalized = normalizeSearchText(search);
  if (!normalized) return false;

  const label = normalizeSearchText(PROFILE_ROLE_LABELS[role] || '');
  if (label && (label.includes(normalized) || normalized.includes(label))) {
    return true;
  }

  for (const token of label.split(/\s+/)) {
    if (token.length >= 3 && (token.startsWith(normalized) || token.includes(normalized))) {
      return true;
    }
  }

  for (const alias of ROLE_SEARCH_ALIASES[role] || []) {
    const a = normalizeSearchText(alias);
    if (!a) continue;
    if (a === normalized || a.startsWith(normalized) || normalized.startsWith(a) || a.includes(normalized)) {
      return true;
    }
  }

  return false;
}

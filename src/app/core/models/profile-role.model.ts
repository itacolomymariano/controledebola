export type ProfileRole =
  | 'athlete'
  | 'referee'
  | 'scout'
  | 'journalist'
  | 'cameraman'
  | 'narrator'
  | 'coach'
  | 'physical_trainer'
  | 'masseur'
  | 'kitman'
  | 'gandula'
  | 'gatekeeper'
  | 'fan';

export const PROFILE_ROLE_LABELS: Record<ProfileRole, string> = {
  athlete: 'Atleta',
  referee: 'Juiz',
  scout: 'Scout / Mesario',
  journalist: 'Jornalista',
  cameraman: 'Cinegrafista',
  narrator: 'Narrador',
  coach: 'Treinador',
  physical_trainer: 'Preparador Fisico',
  masseur: 'Massagista',
  kitman: 'Ropeiro',
  gandula: 'Gandula',
  gatekeeper: 'Porteiro',
  fan: 'Torcedor',
};

/** Nomes que a busca livre da lista de usuarios deve reconhecer, alem do rotulo. */
export const PROFILE_ROLE_SEARCH_ALIASES: Record<ProfileRole, string[]> = {
  athlete: ['atleta', 'atletas'],
  referee: ['juiz', 'juizes', 'arbitro', 'arbitros'],
  scout: ['scout', 'mesario', 'mesarios'],
  journalist: ['jornalista', 'jornalistas'],
  cameraman: ['cinegrafista', 'cinegrafistas'],
  narrator: ['narrador', 'narradores', 'radialista', 'radialistas'],
  coach: ['treinador', 'treinadores', 'tecnico', 'tecnicos'],
  physical_trainer: ['preparador', 'preparador fisico', 'preparadores'],
  masseur: ['massagista', 'massagistas'],
  kitman: ['ropeiro', 'ropeiros'],
  gandula: ['gandula', 'gandulas'],
  gatekeeper: ['porteiro', 'porteiros'],
  fan: ['torcedor', 'torcedores'],
};

export const EVENT_REGISTRATION_ROLES: ProfileRole[] = [
  'athlete',
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
  'gatekeeper',
  'fan',
];

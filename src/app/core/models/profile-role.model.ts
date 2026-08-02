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

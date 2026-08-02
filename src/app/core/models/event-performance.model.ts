import { ProfileRole } from './profile-role.model';

export type MuralTargetRole =
  | 'athlete'
  | 'goalkeeper'
  | 'referee'
  | 'scout'
  | 'journalist'
  | 'cameraman'
  | 'narrator'
  | 'coach'
  | 'physical_trainer'
  | 'masseur'
  | 'kitman'
  | 'gandula';

export const MURAL_TARGET_ROLES: MuralTargetRole[] = [
  'athlete',
  'goalkeeper',
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
];

export const MURAL_TARGET_ROLE_LABELS: Record<MuralTargetRole, string> = {
  athlete: 'Atleta',
  goalkeeper: 'Goleiro',
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
};

export interface EventPerformance {
  objectId: string;
  eventId: string;
  peladaId?: string;
  userId: string;
  userName: string;
  role: ProfileRole | MuralTargetRole;
  goals: number;
  assists: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  points: number;
  shotsOffTarget: number;
  shotsOnTarget: number;
  foulsCommitted: number;
  foulsSuffered: number;
  ownGoals: number;
  passesCompleted: number;
  passesMissed: number;
}

export interface CreateEventPerformancePayload {
  eventId: string;
  userId: string;
  role: MuralTargetRole;
  goals?: number;
  assists?: number;
  saves?: number;
  yellowCards?: number;
  redCards?: number;
  shotsOffTarget?: number;
  shotsOnTarget?: number;
  foulsCommitted?: number;
  foulsSuffered?: number;
  ownGoals?: number;
  passesCompleted?: number;
  passesMissed?: number;
}

export function computePerformanceScore(perf: EventPerformance): number {
  return (
    perf.points +
    perf.goals * 3 +
    perf.assists * 2 +
    perf.saves * 2 -
    perf.yellowCards * 1 -
    perf.redCards * 3
  );
}

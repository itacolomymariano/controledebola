export interface RoleParticipationRecord {
  id: string;
  name: string;
  score: number;
}

export interface RoleParticipationHistory {
  peladas: RoleParticipationRecord[];
  matches: RoleParticipationRecord[];
  teams: RoleParticipationRecord[];
}

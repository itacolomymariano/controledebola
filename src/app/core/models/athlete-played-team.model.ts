import { TeamDirectoryKind } from './team.model';

export type AthletePlayedTeamSource = 'roster' | 'self' | 'manual';

export interface AthletePlayedTeamLink {
  kind: TeamDirectoryKind;
  teamId: string;
  label: string;
  source: AthletePlayedTeamSource;
  imageUrl?: string;
}

export interface AthletePlayedTeamPick {
  id: string;
  kind: TeamDirectoryKind;
  name: string;
  imageUrl?: string;
}

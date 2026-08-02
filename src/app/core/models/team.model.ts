export interface AmateurTeam {
  objectId: string;
  name: string;
  presidentId: string;
  teamImageUrl: string | null;
  presidentImageUrl: string | null;
  uniformId: string;
  uniformColors: [string, string, string];
}

export interface CreateTeamPayload {
  name: string;
  teamImage: File;
  presidentImage: File;
  uniformId: string;
}

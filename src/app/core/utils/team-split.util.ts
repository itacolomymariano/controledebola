import { TeamSplitAthlete, TeamSplitRandomStrategy } from '../models/team-split.model';

function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function orderWithSocioPriority(athletes: TeamSplitAthlete[]): TeamSplitAthlete[] {
  const socios = shuffle(athletes.filter((athlete) => athlete.isSocio));
  const others = shuffle(athletes.filter((athlete) => !athlete.isSocio));
  return [...socios, ...others];
}

function orderForMaritalBalance(athletes: TeamSplitAthlete[]): TeamSplitAthlete[] {
  const base = orderWithSocioPriority(athletes);
  const casados = base.filter((athlete) => athlete.maritalStatus === 'casado');
  const solteiros = base.filter((athlete) => athlete.maritalStatus === 'solteiro');
  const outros = base.filter(
    (athlete) => athlete.maritalStatus !== 'casado' && athlete.maritalStatus !== 'solteiro'
  );

  const result: TeamSplitAthlete[] = [];
  let casadoIndex = 0;
  let solteiroIndex = 0;
  while (casadoIndex < casados.length || solteiroIndex < solteiros.length) {
    if (casadoIndex < casados.length) result.push(casados[casadoIndex++]);
    if (solteiroIndex < solteiros.length) result.push(solteiros[solteiroIndex++]);
  }
  return [...result, ...outros];
}

function orderForFavoriteTeamSpread(athletes: TeamSplitAthlete[]): TeamSplitAthlete[] {
  const byTeam = new Map<string, TeamSplitAthlete[]>();
  for (const athlete of athletes) {
    const key = (athlete.favoriteProTeam || 'Sem time').trim();
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key)!.push(athlete);
  }

  const groups = shuffle(Array.from(byTeam.values()).map((group) => shuffle(group)));
  const result: TeamSplitAthlete[] = [];
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const group of groups) {
      if (group.length) {
        result.push(group.shift()!);
        hasMore = true;
      }
    }
  }
  return orderWithSocioPriority(result);
}

function orderForNeighborhoodSpread(athletes: TeamSplitAthlete[]): TeamSplitAthlete[] {
  const byNeighborhood = new Map<string, TeamSplitAthlete[]>();
  for (const athlete of athletes) {
    const key = (athlete.neighborhood || 'Sem bairro').trim();
    if (!byNeighborhood.has(key)) byNeighborhood.set(key, []);
    byNeighborhood.get(key)!.push(athlete);
  }

  const groups = shuffle(Array.from(byNeighborhood.values()).map((group) => shuffle(group)));
  const result: TeamSplitAthlete[] = [];
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const group of groups) {
      if (group.length) {
        result.push(group.shift()!);
        hasMore = true;
      }
    }
  }
  return orderWithSocioPriority(result);
}

export function buildPositionGroups(athletes: TeamSplitAthlete[]): Array<{
  position: string;
  athletes: TeamSplitAthlete[];
}> {
  const map = new Map<string, TeamSplitAthlete[]>();
  for (const athlete of athletes) {
    const position = athlete.primaryPosition?.trim() || 'Sem posicao';
    if (!map.has(position)) map.set(position, []);
    map.get(position)!.push(athlete);
  }

  return Array.from(map.entries())
    .map(([position, group]) => ({
      position,
      athletes: group.sort((a, b) => {
        const orderDiff = (a.arrivalOrder ?? 9999) - (b.arrivalOrder ?? 9999);
        if (orderDiff !== 0) return orderDiff;
        return a.apelido.localeCompare(b.apelido, 'pt-BR');
      }),
    }))
    .sort((a, b) => a.position.localeCompare(b.position, 'pt-BR'));
}

export function createEmptyTeams(teamCount: number): TeamSplitAthlete[][] {
  return Array.from({ length: teamCount }, () => []);
}

export function randomTeamSplit(
  athletes: TeamSplitAthlete[],
  teamCount: number,
  athletesPerTeam: number,
  strategy: TeamSplitRandomStrategy = 'default'
): TeamSplitAthlete[][] {
  const teams = createEmptyTeams(teamCount);
  if (!teamCount || !athletesPerTeam || !athletes.length) return teams;

  let queue: TeamSplitAthlete[];
  switch (strategy) {
    case 'marital':
      queue = orderForMaritalBalance(athletes);
      break;
    case 'favoriteTeam':
      queue = orderForFavoriteTeamSpread(athletes);
      break;
    case 'neighborhood':
      queue = orderForNeighborhoodSpread(athletes);
      break;
    default:
      queue = orderWithSocioPriority(athletes);
      break;
  }

  let teamIndex = 0;
  for (const athlete of queue) {
    let placed = false;
    for (let attempt = 0; attempt < teamCount; attempt += 1) {
      const index = (teamIndex + attempt) % teamCount;
      if (teams[index].length < athletesPerTeam) {
        teams[index].push(athlete);
        teamIndex = (index + 1) % teamCount;
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }

  return teams;
}

export function poolFromTeams(teams: TeamSplitAthlete[][]): TeamSplitAthlete[] {
  const result: TeamSplitAthlete[] = [];
  for (const team of teams) {
    result.push(...team);
  }
  return result;
}

export function teamsOverCapacity(
  teams: TeamSplitAthlete[][],
  athletesPerTeam: number
): number[] {
  return teams
    .map((team, index) => (team.length > athletesPerTeam ? index : -1))
    .filter((index) => index >= 0);
}

export function removeAthleteFromTeams(
  teams: TeamSplitAthlete[][],
  userId: string
): TeamSplitAthlete | null {
  for (const team of teams) {
    const index = team.findIndex((athlete) => athlete.userId === userId);
    if (index >= 0) {
      return team.splice(index, 1)[0];
    }
  }
  return null;
}

function isAthleteInTeams(teams: TeamSplitAthlete[][], userId: string): boolean {
  for (const team of teams) {
    if (team.some((athlete) => athlete.userId === userId)) {
      return true;
    }
  }
  return false;
}

export function resizeTeamsPreservingAssignments(
  teams: TeamSplitAthlete[][],
  pool: TeamSplitAthlete[],
  newTeamCount: number
): { teams: TeamSplitAthlete[][]; pool: TeamSplitAthlete[] } {
  const normalizedCount = Math.max(1, Math.min(8, newTeamCount));
  const newTeams = createEmptyTeams(normalizedCount);

  for (let index = 0; index < Math.min(teams.length, normalizedCount); index += 1) {
    newTeams[index] = [...teams[index]];
  }

  const poolAthletes: TeamSplitAthlete[] = [...pool];
  const addToPool = (athlete: TeamSplitAthlete): void => {
    if (
      !poolAthletes.some((row) => row.userId === athlete.userId) &&
      !isAthleteInTeams(newTeams, athlete.userId)
    ) {
      poolAthletes.push(athlete);
    }
  };

  if (teams.length > normalizedCount) {
    for (let index = normalizedCount; index < teams.length; index += 1) {
      for (const athlete of teams[index]) {
        addToPool(athlete);
      }
    }
  }

  return { teams: newTeams, pool: poolAthletes };
}

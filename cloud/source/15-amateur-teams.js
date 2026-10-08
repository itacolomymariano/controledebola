/** Elenco de AmateurTeam + perfil publico do time */
const MEMBERSHIP_CLASS = 'AmateurTeamMembership';

function ageFromBirthDate(value) {
  if (!value) return null;
  const birth = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function computeAverageAge(ages) {
  const valid = ages.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, n) => sum + n, 0) / valid.length) * 10) / 10;
}

async function assertTeamPresident(teamId, user) {
  const team = await new Parse.Query('AmateurTeam').include('president').get(teamId, {
    useMasterKey: true,
  });
  const president = team.get('president');
  if (!president || president.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o presidente do time pode gerenciar o elenco.');
  }
  return team;
}

async function mapMembershipRow(row) {
  const user = row.get('user');
  const legend = row.get('legendAthlete');
  let apelido = String(row.get('apelido') || '').trim();
  let avatarUrl = row.get('avatarUrl') || undefined;
  let position = String(row.get('position') || '').trim() || undefined;
  let birthDate = row.get('birthDate') || null;
  let age = ageFromBirthDate(birthDate);

  if (user && user.id) {
    try {
      const full = await new Parse.Query(Parse.User).get(user.id, { useMasterKey: true });
      if (!apelido) {
        apelido =
          String(full.get('apelido') || '').trim() ||
          String(full.get('name') || '').trim() ||
          full.getUsername() ||
          'Atleta';
      }
      if (!birthDate && full.get('birthDate')) birthDate = full.get('birthDate');
      age = ageFromBirthDate(birthDate);
      const avatar = full.get('avatar');
      if (!avatarUrl && avatar && avatar.url) avatarUrl = avatar.url();
      if (!position) {
        const profile = await new Parse.Query('AthleteProfile')
          .equalTo('user', full)
          .first({ useMasterKey: true });
        if (profile) position = String(profile.get('primaryPosition') || '').trim() || undefined;
      }
    } catch {
      // mantem denormalizado
    }
  } else if (legend && legend.id) {
    try {
      const full = await new Parse.Query('AmateurLegendAthlete').get(legend.id, { useMasterKey: true });
      if (!apelido) apelido = String(full.get('apelido') || full.get('name') || 'Lenda').trim();
      if (!position) position = String(full.get('primaryPosition') || '').trim() || undefined;
      if (!birthDate && full.get('birthDate')) birthDate = full.get('birthDate');
      age = ageFromBirthDate(birthDate);
      const photo = full.get('photo') || full.get('image');
      if (!avatarUrl && photo && photo.url) avatarUrl = photo.url();
    } catch {
      // mantem denormalizado
    }
  }

  return {
    objectId: row.id,
    teamId: row.get('team') && row.get('team').id ? row.get('team').id : '',
    userId: user && user.id ? user.id : undefined,
    legendAthleteId: legend && legend.id ? legend.id : undefined,
    source: row.get('source') === 'legend' ? 'legend' : 'athlete',
    apelido: apelido || 'Atleta',
    avatarUrl,
    position,
    age,
    birthDate: birthDate ? new Date(birthDate).toISOString() : null,
  };
}

async function loadRosterAges(teamId) {
  const rows = await new Parse.Query(MEMBERSHIP_CLASS)
    .equalTo('team', Parse.Object.extend('AmateurTeam').createWithoutData(teamId))
    .equalTo('active', true)
    .limit(200)
    .find({ useMasterKey: true });
  const ages = [];
  const members = [];
  for (const row of rows) {
    const mapped = await mapMembershipRow(row);
    members.push(mapped);
    if (typeof mapped.age === 'number') ages.push(mapped.age);
  }
  return { count: rows.length, averageAge: computeAverageAge(ages), members };
}

function personDisplayFromUser(user) {
  if (!user) return { name: '', avatarUrl: '' };
  const name = String(user.get('apelido') || user.get('name') || user.getUsername() || '').trim();
  let avatarUrl = String(user.get('avatarUrl') || '').trim();
  const avatar = user.get('avatar');
  if (!avatarUrl && avatar && typeof avatar.url === 'function') avatarUrl = avatar.url();
  return { name, avatarUrl };
}

function personWinRatePercent(wins, draws, losses) {
  const played = wins + draws + losses;
  if (!played) return null;
  return Math.round(((wins * 3 + draws) / (played * 3)) * 1000) / 10;
}

function unbeatenDurationLabel(fromDate, now) {
  const days = Math.max(0, Math.floor((now.getTime() - fromDate.getTime()) / 86400000));
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return years + (years === 1 ? ' ano' : ' anos');
  }
  if (days >= 14) {
    const weeks = Math.floor(days / 7);
    return weeks + (weeks === 1 ? ' semana' : ' semanas');
  }
  return days + (days === 1 ? ' dia' : ' dias');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function countFansOfTeamName(teamName) {
  const name = String(teamName || '').trim();
  if (!name) return 0;
  const query = new Parse.Query(Parse.User);
  query.matches('favoriteAmateurTeam', '^\\s*' + escapeRegExp(name) + '\\s*$', 'i');
  return query.count({ useMasterKey: true });
}

async function loadCountedTeamMatches(teamId, limit) {
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const capped = Math.min(Math.max(Number(limit) || 1, 1), 200);
  const events = await Parse.Query.or(homeQ, awayQ)
    .lessThanOrEqualTo('startTime', new Date())
    .descending('startTime')
    .limit(capped)
    .find({ useMasterKey: true });
  const matches = [];
  for (const event of events) {
    const actual = await loadCountedTeamMatchScore(event);
    if (!actual) continue;
    const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
    const homeScore = Number(actual.homeScore || 0);
    const awayScore = Number(actual.awayScore || 0);
    const teamScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    matches.push({
      event,
      result: teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D',
      teamSide: isHome ? 'home' : 'away',
      startTime: event.get('startTime') || null,
      homeTeamName: event.get('homeTeamName') || '',
      awayTeamName: event.get('awayTeamName') || '',
      homeScore,
      awayScore,
    });
  }
  return matches;
}

function buildUnbeatenSummary(matches, now) {
  if (!matches.length) return { unbeatenFor: null, lastDefeat: null };
  const streak = [];
  let lastDefeat = null;
  for (const match of matches) {
    if (match.result === 'L') {
      lastDefeat = match;
      break;
    }
    streak.push(match);
  }
  const unbeatenFor = streak.length
    ? unbeatenDurationLabel(new Date(streak[streak.length - 1].startTime || now), now)
    : '0 dias';
  return {
    unbeatenFor,
    lastDefeat: lastDefeat
      ? {
          startTime: lastDefeat.startTime ? new Date(lastDefeat.startTime).toISOString() : null,
          homeTeamName: lastDefeat.homeTeamName,
          awayTeamName: lastDefeat.awayTeamName,
          homeScore: lastDefeat.homeScore,
          awayScore: lastDefeat.awayScore,
        }
      : null,
  };
}

function bumpPersonRecord(bucket, user, result) {
  if (!user || !user.id) return;
  const current = bucket.get(user.id) || {
    userId: user.id,
    name: '',
    avatarUrl: '',
    wins: 0,
    draws: 0,
    losses: 0,
  };
  const display = personDisplayFromUser(user);
  if (!current.name && display.name) current.name = display.name;
  if (!current.avatarUrl && display.avatarUrl) current.avatarUrl = display.avatarUrl;
  if (result === 'W') current.wins += 1;
  else if (result === 'L') current.losses += 1;
  else current.draws += 1;
  bucket.set(user.id, current);
}

function toPublicPerson(row) {
  const played = row.wins + row.draws + row.losses;
  return {
    userId: row.userId,
    name: row.name || 'Atleta',
    avatarUrl: row.avatarUrl || '',
    matchesPlayed: played,
    winRatePercent: played ? personWinRatePercent(row.wins, row.draws, row.losses) : null,
  };
}

async function collectTeamPeopleRecords(matches) {
  const athletes = new Map();
  const coaches = new Map();
  for (const match of matches) {
    const regs = await new Parse.Query('EventRegistration')
      .equalTo('event', match.event)
      .equalTo('teamSide', match.teamSide)
      .containedIn('role', ['athlete', 'coach'])
      .include('user')
      .limit(150)
      .find({ useMasterKey: true });
    for (const reg of regs) {
      const bucket = reg.get('role') === 'coach' ? coaches : athletes;
      bumpPersonRecord(bucket, reg.get('user'), match.result);
    }
  }
  return { athletes, coaches };
}

Parse.Cloud.define('listTeamRoster', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const rows = await new Parse.Query(MEMBERSHIP_CLASS)
    .equalTo('team', teamPtr)
    .equalTo('active', true)
    .ascending('apelido')
    .limit(200)
    .find({ useMasterKey: true });
  const mapped = [];
  for (const row of rows) {
    mapped.push(await mapMembershipRow(row));
  }
  return mapped;
});

Parse.Cloud.define('addTeamMember', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  const athleteUserId = String(request.params.athleteUserId || '').trim();
  const legendAthleteId = String(request.params.legendAthleteId || '').trim();
  if (!teamId || (!athleteUserId && !legendAthleteId)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time e o atleta ou lenda.');
  }
  await assertTeamPresident(teamId, user);

  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const existingQ = new Parse.Query(MEMBERSHIP_CLASS).equalTo('team', teamPtr).equalTo('active', true);
  if (athleteUserId) {
    existingQ.equalTo('user', Parse.User.createWithoutData(athleteUserId));
  } else {
    existingQ.equalTo(
      'legendAthlete',
      Parse.Object.extend('AmateurLegendAthlete').createWithoutData(legendAthleteId)
    );
  }
  const already = await existingQ.first({ useMasterKey: true });
  if (already) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Este atleta ja esta no elenco.');
  }

  const membership = new Parse.Object(MEMBERSHIP_CLASS);
  membership.set('team', teamPtr);
  membership.set('active', true);
  membership.set('addedBy', user);
  if (athleteUserId) {
    membership.set('user', Parse.User.createWithoutData(athleteUserId));
    membership.set('source', 'athlete');
  } else {
    membership.set(
      'legendAthlete',
      Parse.Object.extend('AmateurLegendAthlete').createWithoutData(legendAthleteId)
    );
    membership.set('source', 'legend');
  }
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setWriteAccess(user.id, true);
  membership.setACL(acl);
  await membership.save(null, { useMasterKey: true });
  return mapMembershipRow(membership);
});

Parse.Cloud.define('removeTeamMember', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const membershipId = String(request.params.membershipId || '').trim();
  if (!membershipId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o membro do elenco.');
  }
  const row = await new Parse.Query(MEMBERSHIP_CLASS).include('team').get(membershipId, {
    useMasterKey: true,
  });
  const team = row.get('team');
  if (!team || !team.id) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Time nao encontrado.');
  }
  await assertTeamPresident(team.id, user);
  row.set('active', false);
  await row.save(null, { useMasterKey: true });
  return { ok: true };
});

function mapAmateurTeamListRow(team) {
  const teamImage = team.get('teamImage');
  const shieldImage = team.get('shieldImage');
  const president = team.get('president');
  return {
    objectId: team.id,
    name: team.get('name') || '',
    presidentId: president && president.id ? president.id : '',
    imageUrl: teamImage && teamImage.url ? teamImage.url() : undefined,
    shieldImageUrl: shieldImage && shieldImage.url ? shieldImage.url() : undefined,
    uniformId: team.get('uniformId') || '',
    homeVenue: team.get('homeVenue') || '',
    foundedAt: team.get('foundedAt') ? team.get('foundedAt').toISOString() : null,
  };
}

Parse.Cloud.define('listMyAmateurTeams', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const rows = await new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .ascending('name')
    .limit(5)
    .find({ useMasterKey: true });
  return rows.map(mapAmateurTeamListRow);
});

/**
 * Mesma regra de eventCountsForTeamMatchRanking (17): encerrado OU ja iniciado com placar pronto.
 * Retorna o placar quando o confronto conta; null caso contrario.
 */
async function loadCountedTeamMatchScore(event) {
  const finished = !!event.get('isFinished');
  const start = event.get('startTime');
  if (!finished && (!start || start > new Date())) return null;
  let actual = null;
  try {
    if (typeof buildEventActualPredictionResults === 'function') {
      actual = await buildEventActualPredictionResults(event);
    }
  } catch (error) {
    console.warn('loadCountedTeamMatchScore failed', event.id, error);
  }
  if (!finished && (!actual || !actual.ready)) return null;
  return actual || { homeScore: 0, awayScore: 0, goalScorers: [] };
}

async function loadTeamMatchHistoryRows(teamId, limit = 10) {
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const capped = Math.min(Math.max(Number(limit) || 10, 1), 40);
  const events = await Parse.Query.or(homeQ, awayQ)
    .lessThanOrEqualTo('startTime', new Date())
    .descending('startTime')
    .limit(Math.min(capped * 3, 120))
    .find({ useMasterKey: true });

  const lastResults = [];
  for (const event of events) {
    if (lastResults.length >= capped) break;
    const actual = await loadCountedTeamMatchScore(event);
    if (!actual) continue;
    const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
    const teamScore = isHome ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
    const oppScore = isHome ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
    const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
    lastResults.push({
      eventId: event.id,
      name: event.get('name') || '',
      startTime: event.get('startTime') ? event.get('startTime').toISOString() : null,
      homeTeamName: event.get('homeTeamName') || '',
      awayTeamName: event.get('awayTeamName') || '',
      homeScore: Number(actual.homeScore || 0),
      awayScore: Number(actual.awayScore || 0),
      isFinished: !!event.get('isFinished'),
      result,
    });
  }
  return lastResults;
}

Parse.Cloud.define('listAmateurTeamMatchHistory', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }
  const limit = Number(request.params.limit || 8);
  return loadTeamMatchHistoryRows(teamId, limit);
});

Parse.Cloud.define('getAmateurTeamPublicProfile', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }

  const team = await new Parse.Query('AmateurTeam').include('president').get(teamId, {
    useMasterKey: true,
  });
  const roster = await loadRosterAges(teamId);

  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const events = await Parse.Query.or(homeQ, awayQ)
    .lessThanOrEqualTo('startTime', new Date())
    .descending('startTime')
    .limit(40)
    .find({ useMasterKey: true });

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const scorerMap = new Map();
  const pointsMap = new Map();
  let yellowCards = 0;
  let redCards = 0;
  const observations = [];

  for (const event of events) {
    const actual = await loadCountedTeamMatchScore(event);
    if (!actual) continue;
    const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
    const teamScore = isHome ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
    const oppScore = isHome ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
    const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
    if (result === 'W') wins += 1;
    else if (result === 'L') losses += 1;
    else draws += 1;

    const perfs = await new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .include('user')
      .limit(200)
      .find({ useMasterKey: true });
    for (const perf of perfs) {
      const reg = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .equalTo('user', perf.get('user'))
        .first({ useMasterKey: true });
      const side = reg ? reg.get('teamSide') : null;
      if (side && ((isHome && side !== 'home') || (!isHome && side !== 'away'))) continue;

      const uid = perf.get('user') && perf.get('user').id ? perf.get('user').id : '';
      if (!uid) continue;
      const goals = Number(perf.get('goals') || perf.get('refereeGoals') || 0);
      const points = Number(perf.get('points') || perf.get('score') || 0);
      yellowCards += Math.max(
        Number(perf.get('yellowCards') || 0),
        Number(perf.get('refereeYellowCards') || 0)
      );
      redCards += Math.max(Number(perf.get('redCards') || 0), Number(perf.get('refereeRedCards') || 0));
      const obs = String(perf.get('refereeObservation') || '').trim();
      if (obs && observations.length < 20) {
        observations.push({
          eventId: event.id,
          eventName: event.get('name') || '',
          text: obs,
        });
      }
      if (goals > 0) {
        const prev = scorerMap.get(uid) || { userId: uid, goals: 0, name: '' };
        prev.goals += goals;
        const u = perf.get('user');
        prev.name =
          (u && (u.get('apelido') || u.get('name') || u.getUsername())) || prev.name || 'Atleta';
        scorerMap.set(uid, prev);
      }
      if (points > 0) {
        const prev = pointsMap.get(uid) || { userId: uid, points: 0, name: '' };
        prev.points += points;
        const u = perf.get('user');
        prev.name =
          (u && (u.get('apelido') || u.get('name') || u.getUsername())) || prev.name || 'Atleta';
        pointsMap.set(uid, prev);
      }
    }
  }

  const lastResults = await loadTeamMatchHistoryRows(teamId, 5);
  const countedMatches = await loadCountedTeamMatches(teamId, 200);
  const unbeaten = buildUnbeatenSummary(countedMatches, new Date());
  const people = await collectTeamPeopleRecords(countedMatches);
  const fanCount = await countFansOfTeamName(team.get('name'));
  const athletes = (roster.members || []).map((member) => {
    const record = member.userId ? people.athletes.get(member.userId) : null;
    const person = record ? toPublicPerson(record) : null;
    return {
      userId: member.userId || '',
      name: member.apelido || 'Atleta',
      avatarUrl: member.avatarUrl || '',
      matchesPlayed: person ? person.matchesPlayed : 0,
      winRatePercent: person ? person.winRatePercent : null,
    };
  });
  const coaches = Array.from(people.coaches.values())
    .map(toPublicPerson)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const topScorer = Array.from(scorerMap.values()).sort((a, b) => b.goals - a.goals)[0] || null;
  const topPoints = Array.from(pointsMap.values()).sort((a, b) => b.points - a.points)[0] || null;
  const teamImage = team.get('teamImage');
  const shieldImage = team.get('shieldImage');
  const president = team.get('president');

  return {
    objectId: team.id,
    name: team.get('name') || '',
    description: team.get('description') || '',
    foundedAt: team.get('foundedAt') ? team.get('foundedAt').toISOString() : null,
    homeVenue: team.get('homeVenue') || '',
    imageUrl: teamImage && teamImage.url ? teamImage.url() : undefined,
    shieldImageUrl: shieldImage && shieldImage.url ? shieldImage.url() : undefined,
    presidentId: president && president.id ? president.id : '',
    presidentName: personDisplayFromUser(president).name,
    presidentAvatarUrl: personDisplayFromUser(president).avatarUrl,
    fanCount,
    unbeatenFor: unbeaten.unbeatenFor,
    lastDefeat: unbeaten.lastDefeat,
    athletes,
    coaches,
    averageAge: roster.averageAge,
    rosterCount: roster.count,
    wins,
    losses,
    draws,
    matchesPlayed: wins + losses + draws,
    winRatePercent:
      wins + losses + draws > 0
        ? Math.round(((wins * 3 + draws) / ((wins + losses + draws) * 3)) * 1000) / 10
        : 0,
    lastResults,
    topScorer,
    topPointsAthlete: topPoints,
    yellowCards,
    redCards,
    observations: observations.slice(0, 10),
  };
});

/** Enrich listAmateurTeamsForLegend rows — called from patched list below if needed. */
async function amateurTeamAverageAge(teamId) {
  const { averageAge } = await loadRosterAges(teamId);
  return averageAge;
}

/** Publico de push para confronto: elenco ativo, presidentes, confirmados e contratados aceitos. */
async function collectTeamMatchNotifyUserIds(event) {
  const userIds = new Set();
  const add = (id) => {
    const value = String(id || '').trim();
    if (value) userIds.add(value);
  };

  let homeTeam = event.get('homeTeam');
  let awayTeam = event.get('awayTeam');
  const teamIds = [];

  async function resolveTeam(teamPtr) {
    if (!teamPtr || !teamPtr.id) return null;
    if (teamPtr.get && teamPtr.get('president')) return teamPtr;
    try {
      return await new Parse.Query('AmateurTeam').include('president').get(teamPtr.id, {
        useMasterKey: true,
      });
    } catch {
      return null;
    }
  }

  homeTeam = await resolveTeam(homeTeam);
  awayTeam = await resolveTeam(awayTeam);

  for (const team of [homeTeam, awayTeam]) {
    if (!team || !team.id) continue;
    teamIds.push(team.id);
    const president = team.get('president');
    add(president && president.id);
  }

  for (const teamId of teamIds) {
    const memberships = await new Parse.Query(MEMBERSHIP_CLASS)
      .equalTo('team', Parse.Object.extend('AmateurTeam').createWithoutData(teamId))
      .equalTo('active', true)
      .include('user')
      .limit(200)
      .find({ useMasterKey: true });
    for (const membership of memberships) {
      const memberUser = membership.get('user');
      if (memberUser && memberUser.id) add(memberUser.id);
    }
  }

  if (typeof computeRegistrationEffectiveConfirmation === 'function') {
    const participationFee = Number(event.get('participationFee') || 0);
    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .limit(1000)
      .find({ useMasterKey: true });
    for (const registration of registrations) {
      if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
      const direct = registration.get('participantUserId');
      const regUser = registration.get('user');
      add(direct || (regUser && regUser.id));
    }
  }

  const invitations = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('status', 'accepted')
    .limit(300)
    .find({ useMasterKey: true });
  for (const invitation of invitations) {
    const invited = invitation.get('invitedUser');
    add(invited && invited.id);
  }

  return [...userIds];
}

const TEAM_JOIN_REQUEST_CLASS = 'AmateurTeamJoinRequest';

function mapAmateurTeamJoinRequestRow(row) {
  const team = row.get('team');
  const athlete = row.get('athlete');
  const president = row.get('president');
  return {
    objectId: row.id,
    status: String(row.get('status') || 'pending'),
    teamId: team && team.id ? team.id : '',
    teamName: String(row.get('teamName') || ''),
    athleteUserId: athlete && athlete.id ? athlete.id : '',
    athleteApelido: String(row.get('athleteApelido') || ''),
    athleteFullName: String(row.get('athleteFullName') || ''),
    athleteAvatarUrl: row.get('athleteAvatarUrl') || undefined,
    presidentUserId: president && president.id ? president.id : '',
    presidentApelido: String(row.get('presidentApelido') || ''),
    message: String(row.get('message') || ''),
    declineReason: String(row.get('declineReason') || ''),
    createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : null,
    respondedAt: row.get('respondedAt') ? row.get('respondedAt').toISOString() : null,
  };
}

Parse.Cloud.define('requestAmateurTeamJoin', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  const message = String(request.params.message || '').trim().slice(0, 500);
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }

  const team = await new Parse.Query('AmateurTeam').include('president').get(teamId, {
    useMasterKey: true,
  });
  const president = team.get('president');
  if (!president || !president.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time sem presidente cadastrado.');
  }
  if (president.id === user.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Voce ja e o presidente deste time.');
  }

  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const rosterQ = new Parse.Query(MEMBERSHIP_CLASS)
    .equalTo('team', teamPtr)
    .equalTo('user', user)
    .equalTo('active', true);
  const onRoster = await rosterQ.first({ useMasterKey: true });
  if (onRoster) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Voce ja faz parte do elenco.');
  }

  const duplicate = await new Parse.Query(TEAM_JOIN_REQUEST_CLASS)
    .equalTo('team', teamPtr)
    .equalTo('athlete', user)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Ja existe uma solicitacao pendente.');
  }

  try {
    await user.fetch({ useMasterKey: true });
  } catch {
    /* sessao */
  }
  const athleteApelido = String(user.get('apelido') || '').trim();
  const athleteFullName = String(user.get('name') || '').trim();
  const athleteAvatar = String(user.get('avatarUrl') || '').trim();
  let presidentApelido = '';
  try {
    await president.fetch({ useMasterKey: true });
    presidentApelido = String(president.get('apelido') || president.get('name') || '').trim();
  } catch {
    presidentApelido = '';
  }

  const teamName = String(team.get('name') || 'Time');
  const row = new Parse.Object(TEAM_JOIN_REQUEST_CLASS);
  row.set('team', teamPtr);
  row.set('athlete', user);
  row.set('president', president);
  row.set('teamName', teamName);
  row.set('status', 'pending');
  row.set('message', message);
  row.set('athleteApelido', athleteApelido);
  row.set('athleteFullName', athleteFullName);
  if (athleteAvatar) row.set('athleteAvatarUrl', athleteAvatar);
  row.set('presidentApelido', presidentApelido);
  const acl = new Parse.ACL();
  acl.setReadAccess(user.id, true);
  acl.setWriteAccess(user.id, true);
  acl.setReadAccess(president.id, true);
  acl.setWriteAccess(president.id, true);
  row.setACL(acl);
  await row.save(null, { useMasterKey: true });

  if (typeof createAppMessage === 'function') {
    const athleteName = athleteApelido || athleteFullName || 'Um atleta';
    await createAppMessage({
      recipientId: president.id,
      senderId: user.id,
      kind: 'amateur_team_join_request',
      title: `Pedido para entrar no time ${teamName}`,
      body: `${athleteName} pediu para participar do elenco de "${teamName}". Autorize ou recuse na Entrada.`,
      relatedClass: TEAM_JOIN_REQUEST_CLASS,
      relatedId: row.id,
      actionRoute: '/inbox',
    });
    await createAppMessage({
      recipientId: user.id,
      senderId: user.id,
      kind: 'amateur_team_join_outbox',
      title: `Solicitacao enviada — ${teamName}`,
      body: `Seu pedido para participar de "${teamName}" foi enviado ao presidente.`,
      relatedClass: TEAM_JOIN_REQUEST_CLASS,
      relatedId: row.id,
      actionRoute: `/team/${teamId}`,
    });
  }

  return mapAmateurTeamJoinRequestRow(row);
});

Parse.Cloud.define('respondAmateurTeamJoin', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const requestId = String(request.params.requestId || '').trim();
  const decision = String(request.params.decision || '').trim();
  const declineReason = String(request.params.declineReason || '').trim().slice(0, 500);
  if (!requestId || (decision !== 'accepted' && decision !== 'declined')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a solicitacao e a decisao.');
  }

  const row = await new Parse.Query(TEAM_JOIN_REQUEST_CLASS)
    .include('team')
    .include('athlete')
    .include('president')
    .get(requestId, { useMasterKey: true });
  const president = row.get('president');
  if (!president || president.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Somente o presidente pode responder.');
  }
  if (String(row.get('status') || '') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Esta solicitacao ja foi respondida.');
  }

  const athlete = row.get('athlete');
  const team = row.get('team');
  const teamName = String(row.get('teamName') || 'Time');
  row.set('respondedAt', new Date());

  if (decision === 'declined') {
    row.set('status', 'declined');
    row.set('declineReason', declineReason);
    await row.save(null, { useMasterKey: true });
    if (typeof createAppMessage === 'function' && athlete && athlete.id) {
      await createAppMessage({
        recipientId: athlete.id,
        senderId: user.id,
        kind: 'amateur_team_join_declined',
        title: `Pedido recusado — ${teamName}`,
        body: declineReason
          ? `Seu pedido para "${teamName}" foi recusado: ${declineReason}`
          : `Seu pedido para participar de "${teamName}" foi recusado.`,
        relatedClass: TEAM_JOIN_REQUEST_CLASS,
        relatedId: row.id,
        actionRoute: team && team.id ? `/team/${team.id}` : '/inbox',
      });
    }
    return mapAmateurTeamJoinRequestRow(row);
  }

  if (!team || !team.id || !athlete || !athlete.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao incompleta.');
  }

  const existingQ = new Parse.Query(MEMBERSHIP_CLASS)
    .equalTo('team', team)
    .equalTo('user', athlete)
    .equalTo('active', true);
  const already = await existingQ.first({ useMasterKey: true });
  if (!already) {
    const membership = new Parse.Object(MEMBERSHIP_CLASS);
    membership.set('team', team);
    membership.set('user', athlete);
    membership.set('active', true);
    membership.set('addedBy', user);
    membership.set('source', 'join_request');
    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    acl.setWriteAccess(user.id, true);
    membership.setACL(acl);
    await membership.save(null, { useMasterKey: true });
  }

  row.set('status', 'accepted');
  await row.save(null, { useMasterKey: true });

  if (typeof createAppMessage === 'function') {
    await createAppMessage({
      recipientId: athlete.id,
      senderId: user.id,
      kind: 'amateur_team_join_accepted',
      title: `Pedido aceito — ${teamName}`,
      body: `Voce foi incluido no elenco de "${teamName}".`,
      relatedClass: TEAM_JOIN_REQUEST_CLASS,
      relatedId: row.id,
      actionRoute: `/team/${team.id}`,
    });
  }

  return mapAmateurTeamJoinRequestRow(row);
});

Parse.Cloud.define('listMyAmateurTeamJoinRequests', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const asAthlete = new Parse.Query(TEAM_JOIN_REQUEST_CLASS).equalTo('athlete', user);
  const asPresident = new Parse.Query(TEAM_JOIN_REQUEST_CLASS).equalTo('president', user);
  const query = Parse.Query.or(asAthlete, asPresident);
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapAmateurTeamJoinRequestRow);
});

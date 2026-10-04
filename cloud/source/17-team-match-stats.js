/** Estatisticas de confrontos (times e usuarios) */

function teamMatchWinRatePercent(wins, draws, played) {
  if (!played || played <= 0) return 0;
  return Math.round(((wins * 3 + draws) / (played * 3)) * 1000) / 10;
}

async function eventCountsForTeamMatchRanking(event) {
  if (event.get('isFinished')) return true;
  const start = event.get('startTime');
  if (!start || start > new Date()) return false;
  try {
    if (typeof buildEventActualPredictionResults === 'function') {
      const actual = await buildEventActualPredictionResults(event);
      return !!(actual && actual.ready);
    }
  } catch {
    return false;
  }
  return false;
}

async function loadFinishedTeamMatchEventsForTeam(teamId, limit) {
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const cap = Math.min(Math.max(Number(limit) || 500, 1), 500);
  const candidates = await Parse.Query.or(homeQ, awayQ)
    .lessThan('startTime', new Date())
    .descending('startTime')
    .limit(cap)
    .find({ useMasterKey: true });
  const events = [];
  for (const event of candidates) {
    if (await eventCountsForTeamMatchRanking(event)) {
      events.push(event);
    }
  }
  return events;
}

async function teamMatchResultForTeam(event, teamId) {
  let actual = { ready: false, homeScore: 0, awayScore: 0 };
  try {
    if (typeof buildEventActualPredictionResults === 'function') {
      actual = await buildEventActualPredictionResults(event);
    }
  } catch {
    return null;
  }
  if (!event.get('isFinished') && (!actual || actual.ready === false)) {
    return null;
  }
  const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
  const teamScore = isHome ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
  const oppScore = isHome ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
  if (teamScore > oppScore) return 'W';
  if (teamScore < oppScore) return 'L';
  return 'D';
}

async function computeAmateurTeamMatchRecord(teamId, limit) {
  const events = await loadFinishedTeamMatchEventsForTeam(teamId, limit);
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const event of events) {
    const r = await teamMatchResultForTeam(event, teamId);
    if (r === 'W') wins += 1;
    else if (r === 'L') losses += 1;
    else if (r === 'D') draws += 1;
  }
  const played = wins + losses + draws;
  return {
    matchesPlayed: played,
    wins,
    losses,
    draws,
    winRatePercent: teamMatchWinRatePercent(wins, draws, played),
  };
}

async function resolveCoachTeamSideForStats(event, userId, reg) {
  const explicit = reg && reg.get ? reg.get('teamSide') : '';
  if (explicit === 'home' || explicit === 'away') return explicit;
  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', Parse.User.createWithoutData(userId))
    .equalTo('role', 'coach')
    .equalTo('status', 'accepted')
    .descending('createdAt')
    .first({ useMasterKey: true });
  const invSide = invitation ? invitation.get('teamSide') : '';
  if (invSide === 'home' || invSide === 'away') return invSide;
  const invitedBy =
    (invitation && invitation.get('invitedBy')) || (reg && reg.get && reg.get('invitedBy')) || null;
  if (!invitedBy || !invitedBy.id) return '';
  const matches = [];
  for (const side of ['home', 'away']) {
    let team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    if (!team || !team.id) continue;
    let president = team.get ? team.get('president') : null;
    if (!president) {
      try {
        team = await new Parse.Query('AmateurTeam').get(team.id, { useMasterKey: true });
        president = team.get('president');
      } catch {
        president = null;
      }
    }
    if (president && president.id === invitedBy.id) matches.push(side);
  }
  return matches.length === 1 ? matches[0] : '';
}

async function computeUserTeamMatchRecord(userId, roleContext) {
  const userPtr = Parse.User.createWithoutData(userId);
  const regQuery = new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .containedIn('role', roleContext === 'coach' ? ['coach'] : ['athlete', 'goalkeeper'])
    .limit(500);
  const registrations = await regQuery.find({ useMasterKey: true });
  if (!registrations.length) {
    return { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, winRatePercent: 0 };
  }

  const eventIds = [...new Set(registrations.map((r) => r.get('event') && r.get('event').id).filter(Boolean))];
  const events = [];
  for (let i = 0; i < eventIds.length; i += 50) {
    const batch = eventIds.slice(i, i + 50);
    const q = new Parse.Query('Event');
    q.containedIn('objectId', batch);
    q.equalTo('type', 'team_match');
    q.lessThan('startTime', new Date());
    events.push(...(await q.find({ useMasterKey: true })));
  }
  const eventById = new Map(events.map((e) => [e.id, e]));
  const regByEvent = new Map();
  for (const reg of registrations) {
    const ev = reg.get('event');
    if (!ev || !ev.id) continue;
    regByEvent.set(ev.id, reg);
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const [eventId, reg] of regByEvent.entries()) {
    const event = eventById.get(eventId);
    if (!event) continue;
    if (!(await eventCountsForTeamMatchRanking(event))) continue;
    const participationFee = Number(event.get('participationFee') || 0);
    if (!computeRegistrationEffectiveConfirmation(reg, participationFee)) continue;

    if (roleContext === 'athlete') {
      const role = reg.get('role');
      let athlete = reg.get('athlete');
      if (athlete && !athlete.get && athlete.id) {
        try {
          athlete = await new Parse.Query('AthleteProfile').get(athlete.id, { useMasterKey: true });
        } catch {
          athlete = null;
        }
      }
      const pos = athlete && athlete.get ? String(athlete.get('primaryPosition') || '') : '';
      const isGk =
        role === 'goalkeeper' ||
        (typeof isGoalkeeperPosition === 'function'
          ? isGoalkeeperPosition(pos)
          : String(pos).trim().toLowerCase() === 'goleiro');
      // Top rankings excluem goleiros; record inclui todos os atletas confirmados.
    }

    const side =
      roleContext === 'coach'
        ? await resolveCoachTeamSideForStats(event, userId, reg)
        : reg.get('teamSide');
    if (side !== 'home' && side !== 'away') continue;

    let actual = { ready: false, homeScore: 0, awayScore: 0 };
    try {
      if (typeof buildEventActualPredictionResults === 'function') {
        actual = await buildEventActualPredictionResults(event);
      }
    } catch {
      continue;
    }
    if (!event.get('isFinished') && (!actual || actual.ready === false)) {
      continue;
    }
    const teamScore = side === 'home' ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
    const oppScore = side === 'home' ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
    if (teamScore > oppScore) wins += 1;
    else if (teamScore < oppScore) losses += 1;
    else draws += 1;
  }

  const played = wins + losses + draws;
  return {
    matchesPlayed: played,
    wins,
    losses,
    draws,
    winRatePercent: teamMatchWinRatePercent(wins, draws, played),
  };
}

Parse.Cloud.define('getUserTeamMatchRecord', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id || '').trim();
  const roleContext = request.params.roleContext === 'coach' ? 'coach' : 'athlete';
  if (!userId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o usuario.');
  }
  return computeUserTeamMatchRecord(userId, roleContext);
});

Parse.Cloud.define('getPresidentTeamMatchRecord', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id || '').trim();
  if (!userId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o usuario.');
  }
  const president = Parse.User.createWithoutData(userId);
  const teams = await new Parse.Query('AmateurTeam')
    .equalTo('president', president)
    .limit(20)
    .find({ useMasterKey: true });
  let matchesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const team of teams) {
    const row = await computeAmateurTeamMatchRecord(team.id, 500);
    matchesPlayed += row.matchesPlayed;
    wins += row.wins;
    losses += row.losses;
    draws += row.draws;
  }
  return {
    matchesPlayed,
    wins,
    losses,
    draws,
    winRatePercent: teamMatchWinRatePercent(wins, draws, matchesPlayed),
    teamsPresided: teams.length,
  };
});

Parse.Cloud.define('getAmateurTeamMatchRecord', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }
  return computeAmateurTeamMatchRecord(teamId, 500);
});

function incrementLocationBucket(map, key, label) {
  if (!key) return;
  const current = map.get(key) || { key, label, count: 0 };
  current.count += 1;
  map.set(key, current);
}

function buildEventLocationStats(events) {
  const byState = new Map();
  const byCity = new Map();
  const byNeighborhood = new Map();
  for (const event of events) {
    const address = event.get('address') || {};
    let state = String(address.state || address.uf || '').trim().toUpperCase();
    if (state === 'FE') state = 'DF';
    const city = String(address.city || '').trim();
    const neighborhood = String(address.neighborhood || address.district || '').trim();
    incrementLocationBucket(byState, state, state || '—');
    const cityKey = state && city ? `${state}|${city}` : city;
    incrementLocationBucket(byCity, cityKey, city ? `${city}${state ? ' - ' + state : ''}` : '—');
    const nbKey = cityKey && neighborhood ? `${cityKey}|${neighborhood}` : neighborhood;
    incrementLocationBucket(byNeighborhood, nbKey, neighborhood || '—');
  }
  const sortDesc = (entries) => entries.sort((a, b) => b.count - a.count);
  return {
    byState: sortDesc(Array.from(byState.values())),
    byCity: sortDesc(Array.from(byCity.values())),
    byNeighborhood: sortDesc(Array.from(byNeighborhood.values())),
  };
}

function teamMatchStandingPoints(wins, draws) {
  return Number(wins || 0) * 3 + Number(draws || 0);
}

function sliceTopRankWithTies(sorted, topN, scoreKey = 'combinedScore') {
  if (!sorted.length) return [];
  if (sorted.length <= topN) return sorted;
  const threshold = sorted[topN - 1][scoreKey];
  return sorted.filter((row) => (row[scoreKey] || 0) >= threshold);
}

async function enrichTopTeamRankEntries(entries) {
  const out = [];
  for (const entry of entries) {
    try {
      const team = await new Parse.Query('AmateurTeam')
        .include('president')
        .get(entry.teamId, { useMasterKey: true });
      const president = team.get('president');
      const shieldImage = team.get('shieldImage');
      let presidentAvatarUrl;
      let presidentName = '';
      if (president && president.get) {
        presidentName =
          president.get('apelido') || president.get('name') || president.getUsername() || '';
        if (typeof resolveStoredAvatarUrl === 'function') {
          presidentAvatarUrl = resolveStoredAvatarUrl(president) || undefined;
        } else {
          presidentAvatarUrl = (president.get('avatarUrl') || '').trim() || undefined;
        }
      }
      out.push({
        ...entry,
        teamName: team.get('name') || entry.teamName || 'Time',
        shieldImageUrl: shieldImage && shieldImage.url ? shieldImage.url() : undefined,
        foundedAt: team.get('foundedAt') ? team.get('foundedAt').toISOString() : null,
        homeVenue: team.get('homeVenue') || '',
        presidentId: president && president.id ? president.id : '',
        presidentName,
        presidentAvatarUrl,
      });
    } catch {
      out.push(entry);
    }
  }
  return out;
}

async function countAmateurTeamsCoached(userId) {
  const userPtr = Parse.User.createWithoutData(userId);
  const regs = await new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .equalTo('role', 'coach')
    .limit(2000)
    .find({ useMasterKey: true });
  const teamIds = new Set();
  for (const reg of regs) {
    let event = reg.get('event');
    if (!event || !event.id) continue;
    if (!event.get || !event.get('type')) {
      try {
        event = await new Parse.Query('Event').get(event.id, { useMasterKey: true });
      } catch {
        continue;
      }
    }
    if (event.get('type') !== 'team_match') continue;
    const side = await resolveCoachTeamSideForStats(event, userId, reg);
    if (side !== 'home' && side !== 'away') continue;
    const home = event.get('homeTeam');
    const away = event.get('awayTeam');
    const tid =
      side === 'home' && home && home.id
        ? home.id
        : side === 'away' && away && away.id
          ? away.id
          : null;
    if (tid) teamIds.add(String(tid));
  }
  return teamIds.size;
}

async function buildTopTeamsByMatchPoints(topN = 10) {
  const teams = await new Parse.Query('AmateurTeam').limit(300).find({ useMasterKey: true });
  const teamRecords = [];
  for (const team of teams) {
    const record = await computeAmateurTeamMatchRecord(team.id, 500);
    if (!record.matchesPlayed) continue;
    const points = teamMatchStandingPoints(record.wins, record.draws);
    teamRecords.push({
      teamId: team.id,
      teamName: team.get('name') || 'Time',
      ...record,
      combinedScore: points,
      totalScore: points,
    });
  }

  teamRecords.sort((a, b) => {
    const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
    if (diff !== 0) return diff;
    return (b.winRatePercent || 0) - (a.winRatePercent || 0);
  });
  const sliced = sliceTopRankWithTies(teamRecords, topN);
  return enrichTopTeamRankEntries(sliced);
}

async function buildTopCoachesByMatchPoints(topN = 10) {
  const coachRegs = await new Parse.Query('EventRegistration')
    .equalTo('role', 'coach')
    .limit(2000)
    .find({ useMasterKey: true });
  const coachIds = new Set();
  for (const reg of coachRegs) {
    const user = reg.get('user');
    if (user && user.id) coachIds.add(String(user.id));
  }

  const entries = [];
  for (const userId of coachIds) {
    const record = await computeUserTeamMatchRecord(userId, 'coach');
    if (!record.matchesPlayed) continue;
    const points = teamMatchStandingPoints(record.wins, record.draws);
    const teamsCoachedCount = await countAmateurTeamsCoached(userId);
    entries.push({
      userId,
      userName: 'Treinador',
      role: 'coach',
      matchesPlayed: record.matchesPlayed,
      wins: record.wins,
      losses: record.losses,
      draws: record.draws,
      winRatePercent: record.winRatePercent,
      teamsCoachedCount,
      combinedScore: points,
      totalScore: points,
    });
  }

  entries.sort((a, b) => {
    const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
    if (diff !== 0) return diff;
    return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
  });

  let slice = sliceTopRankWithTies(entries, topN);
  if (typeof enrichMuralRankingNames === 'function') {
    const enriched = await enrichMuralRankingNames('app', undefined, { coach: slice });
    slice = enriched.coach || slice;
    if (typeof loadUserAgesForRanking === 'function') {
      const ageByUserId = await loadUserAgesForRanking(slice.map((row) => row.userId));
      slice = slice.map((row) => ({
        ...row,
        age: ageByUserId.get(row.userId) || undefined,
      }));
      slice.sort((a, b) => {
        const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
        if (diff !== 0) return diff;
        return (b.age || 0) - (a.age || 0);
      });
      slice = sliceTopRankWithTies(slice, topN);
    }
  }
  return slice;
}

/* ---------- Cards de destaque da aba Confrontos ---------- */

/** Teto de confrontos considerados nos cards (os mais recentes que contam). */
const TEAM_MATCH_SPOTLIGHT_EVENT_LIMIT = 300;
const TEAM_MATCH_BEST_DEFENSE_MIN_MATCHES = 3;
const TEAM_MATCH_DEFENDER_POSITIONS = ['zagueiro', 'lateral direito', 'lateral esquerdo'];

function normalizeTeamMatchPositionLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isTeamMatchDefenderPosition(value) {
  return TEAM_MATCH_DEFENDER_POSITIONS.includes(normalizeTeamMatchPositionLabel(value));
}

function teamMatchRoundOneDecimal(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

/** Mesmo criterio de pontuacao de desempenho usado no mural (sem o peso 3x do confronto). */
function teamMatchPerformancePoints(perf) {
  if (typeof computeEffectivePerformanceScore === 'function') {
    return Number(computeEffectivePerformanceScore(perf, 'referee') || 0);
  }
  const stored =
    typeof computeStoredPerformancePoints === 'function' ? computeStoredPerformancePoints(perf) : 0;
  return Number(perf.get('points') || 0) + Number(stored || 0);
}

function teamMatchRefereeGoals(perf) {
  if (typeof mapPerformanceToRefereeSumula === 'function') {
    return Number(mapPerformanceToRefereeSumula(perf).goals || 0);
  }
  return Number(perf.get('refereeGoals') || 0);
}

/** Ids que ligam inscricao e desempenho (participantUserId e ponteiro user). */
function teamMatchPersonKeysFromRegistration(registration) {
  const keys = [];
  const explicit = registration.get('participantUserId');
  if (explicit) keys.push(String(explicit));
  const user = registration.get('user');
  if (user && user.id) keys.push(String(user.id));
  return keys;
}

function teamMatchPersonKeysFromPerformance(perf) {
  if (typeof collectPerformanceParticipantKeys === 'function') {
    return collectPerformanceParticipantKeys(perf);
  }
  const keys = [];
  const explicit = perf.get('participantUserId');
  if (explicit) keys.push(String(explicit));
  const user = perf.get('user');
  if (user && user.id) keys.push(String(user.id));
  return keys;
}

/**
 * Consulta por ponteiro de evento usando os objetos ja carregados.
 * createWithoutData no containedIn nao casa com o ponteiro gravado e a lista volta vazia.
 */
async function findRowsForEvents(className, events, configure) {
  const rows = [];
  const pageSize = 1000;
  for (let i = 0; i < events.length; i += 40) {
    const batch = events.slice(i, i + 40);
    let skip = 0;
    for (;;) {
      const query = new Parse.Query(className);
      query.containedIn('event', batch);
      if (configure) configure(query);
      query.limit(pageSize);
      query.skip(skip);
      const page = await query.find({ useMasterKey: true });
      rows.push(...page);
      if (page.length < pageSize) break;
      skip += page.length;
      if (skip > 8000) break;
    }
  }
  return rows;
}

/** Lados (home/away) dos atletas efetivamente confirmados, em lote por evento. */
async function loadTeamMatchSidesByEvent(events) {
  const byEvent = new Map();
  const feeByEvent = new Map();
  for (const event of events) {
    byEvent.set(String(event.id), { home: new Set(), away: new Set() });
    feeByEvent.set(String(event.id), Number(event.get('participationFee') || 0));
  }
  const registrations = await findRowsForEvents('EventRegistration', events, (query) => {
    query.containedIn('role', ['athlete', 'goalkeeper']);
  });
  for (const registration of registrations) {
    const event = registration.get('event');
    const eventId = event && event.id ? String(event.id) : '';
    const sides = byEvent.get(eventId);
    if (!sides) continue;
    const side = registration.get('teamSide');
    if (side !== 'home' && side !== 'away') continue;
    if (
      typeof computeRegistrationEffectiveConfirmation === 'function' &&
      !computeRegistrationEffectiveConfirmation(registration, feeByEvent.get(eventId) || 0)
    ) {
      continue;
    }
    for (const participantId of teamMatchPersonKeysFromRegistration(registration)) {
      sides[side].add(participantId);
    }
  }
  return byEvent;
}

async function loadTeamMatchPersonDisplayById(userIds) {
  const ids = Array.from(new Set((userIds || []).map(String).filter(Boolean)));
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const users = await new Parse.Query(Parse.User)
      .containedIn('objectId', ids.slice(i, i + 100))
      .limit(100)
      .find({ useMasterKey: true });
    for (const user of users) {
      byId.set(
        user.id,
        typeof personDisplayFromUser === 'function'
          ? personDisplayFromUser(user)
          : {
              name: String(user.get('apelido') || user.get('name') || user.getUsername() || ''),
              avatarUrl: String(user.get('avatarUrl') || ''),
            }
      );
    }
  }
  return byId;
}

async function loadTeamMatchDefenderUserIds(userIds) {
  const ids = Array.from(new Set((userIds || []).map(String).filter(Boolean)));
  const defenders = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const profiles = await new Parse.Query('AthleteProfile')
      .containedIn(
        'user',
        ids.slice(i, i + 100).map((id) => Parse.User.createWithoutData(id))
      )
      .limit(500)
      .find({ useMasterKey: true });
    for (const profile of profiles) {
      if (!isTeamMatchDefenderPosition(profile.get('primaryPosition'))) continue;
      const user = profile.get('user');
      if (user && user.id) defenders.add(String(user.id));
    }
  }
  return defenders;
}

/**
 * Agrega os confrontos ja carregados (uma unica passada) e devolve os quatro cards
 * de destaque: melhor time, maior invencibilidade, melhor ataque e melhor defesa.
 */
async function buildTeamMatchSpotlightCards(events, performanceRaw) {
  const empty = {
    teamRows: [],
    bestTeam: null,
    longestUnbeaten: null,
    bestAttack: null,
    bestDefense: null,
  };
  if (!events.length) return empty;

  const eventById = new Map(events.map((event) => [String(event.id), event]));
  const sidesByEvent = await loadTeamMatchSidesByEvent(events);

  const perfByEvent = new Map();
  for (const perf of performanceRaw || []) {
    const event = perf.get('event');
    const eventId = event && event.id ? String(event.id) : '';
    if (!eventId || !eventById.has(eventId)) continue;
    if (!perfByEvent.has(eventId)) perfByEvent.set(eventId, []);
    perfByEvent.get(eventId).push(perf);
  }

  const teams = new Map();
  const ensureTeam = (teamId, teamName) => {
    let agg = teams.get(teamId);
    if (!agg) {
      agg = {
        teamId,
        teamName: teamName || 'Time',
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        matches: [],
        goalsByUser: new Map(),
        pointsByUser: new Map(),
      };
      teams.set(teamId, agg);
    }
    if (!agg.teamName && teamName) agg.teamName = teamName;
    return agg;
  };

  // events ja vem do mais recente para o mais antigo (descending startTime).
  for (const event of events) {
    const home = event.get('homeTeam');
    const away = event.get('awayTeam');
    const homeId = home && home.id ? String(home.id) : '';
    const awayId = away && away.id ? String(away.id) : '';
    if (!homeId && !awayId) continue;

    const sides = sidesByEvent.get(String(event.id)) || { home: new Set(), away: new Set() };
    const score = { home: 0, away: 0 };
    const goalsBySide = { home: new Map(), away: new Map() };
    const pointsBySide = { home: new Map(), away: new Map() };

    for (const perf of perfByEvent.get(String(event.id)) || []) {
      const keys = teamMatchPersonKeysFromPerformance(perf);
      if (!keys.length) continue;
      const side = keys.some((key) => sides.home.has(key))
        ? 'home'
        : keys.some((key) => sides.away.has(key))
          ? 'away'
          : '';
      if (!side) continue;
      const participantId =
        keys.find((key) => (side === 'home' ? sides.home.has(key) : sides.away.has(key))) ||
        keys[0];

      // Placar do confronto = soma dos refereeGoals por lado (mesma regra da sumula).
      const goals = teamMatchRefereeGoals(perf);
      if (goals > 0) {
        score[side] += goals;
        goalsBySide[side].set(participantId, (goalsBySide[side].get(participantId) || 0) + goals);
      }
      const points = teamMatchPerformancePoints(perf);
      if (points) {
        pointsBySide[side].set(participantId, (pointsBySide[side].get(participantId) || 0) + points);
      }
    }

    const startTime = event.get('startTime') || null;
    const applySide = (teamId, teamName, side) => {
      if (!teamId) return;
      const scored = side === 'home' ? score.home : score.away;
      const conceded = side === 'home' ? score.away : score.home;
      const agg = ensureTeam(teamId, teamName);
      agg.matchesPlayed += 1;
      agg.goalsFor += scored;
      agg.goalsAgainst += conceded;
      if (scored > conceded) agg.wins += 1;
      else if (scored < conceded) agg.losses += 1;
      else agg.draws += 1;
      agg.matches.push({
        result: scored > conceded ? 'W' : scored < conceded ? 'L' : 'D',
        startTime,
      });
      for (const [userId, goals] of goalsBySide[side].entries()) {
        agg.goalsByUser.set(userId, (agg.goalsByUser.get(userId) || 0) + goals);
      }
      for (const [userId, points] of pointsBySide[side].entries()) {
        agg.pointsByUser.set(userId, (agg.pointsByUser.get(userId) || 0) + points);
      }
    };

    applySide(homeId, event.get('homeTeamName') || '', 'home');
    applySide(awayId, event.get('awayTeamName') || '', 'away');
  }

  const rows = Array.from(teams.values());
  if (!rows.length) return empty;

  const withRate = rows.map((row) => ({
    ...row,
    winRatePercent: teamMatchWinRatePercent(row.wins, row.draws, row.matchesPlayed),
  }));

  // 1) Melhor time: mais confrontos realizados; empate pelo maior aproveitamento.
  const bestTeamRow =
    [...withRate].sort((a, b) => {
      const diff = b.matchesPlayed - a.matchesPlayed;
      if (diff !== 0) return diff;
      return b.winRatePercent - a.winRatePercent;
    })[0] || null;

  // 2) Maior invencibilidade: mesma regra de buildUnbeatenSummary (15-amateur-teams.js).
  const now = new Date();
  let longestUnbeatenRow = null;
  for (const row of withRate) {
    const streak = [];
    for (const match of row.matches) {
      if (match.result === 'L') break;
      streak.push(match);
    }
    if (!streak.length) continue;
    const since = streak[streak.length - 1].startTime
      ? new Date(streak[streak.length - 1].startTime)
      : now;
    const summary =
      typeof buildUnbeatenSummary === 'function'
        ? buildUnbeatenSummary(row.matches, now)
        : { unbeatenFor: '' };
    const candidate = {
      row,
      matchesInStreak: streak.length,
      sinceStartTime: since,
      unbeatenDays: Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86400000)),
      unbeatenLabel: summary.unbeatenFor || '',
    };
    if (
      !longestUnbeatenRow ||
      candidate.matchesInStreak > longestUnbeatenRow.matchesInStreak ||
      (candidate.matchesInStreak === longestUnbeatenRow.matchesInStreak &&
        candidate.unbeatenDays > longestUnbeatenRow.unbeatenDays)
    ) {
      longestUnbeatenRow = candidate;
    }
  }

  // 3) Melhor ataque: mais gols feitos.
  const bestAttackRow =
    [...withRate].sort((a, b) => {
      const diff = b.goalsFor - a.goalsFor;
      if (diff !== 0) return diff;
      const perMatch =
        (b.goalsFor / (b.matchesPlayed || 1)) - (a.goalsFor / (a.matchesPlayed || 1));
      if (perMatch !== 0) return perMatch;
      return b.matchesPlayed - a.matchesPlayed;
    })[0] || null;

  // 4) Melhor defesa: menos gols sofridos, com minimo de confrontos para evitar quem jogou uma vez.
  const maxPlayed = withRate.reduce((max, row) => Math.max(max, row.matchesPlayed), 0);
  const minMatches = Math.max(1, Math.min(TEAM_MATCH_BEST_DEFENSE_MIN_MATCHES, maxPlayed));
  const defenseCandidates = withRate.filter((row) => row.matchesPlayed >= minMatches);
  const bestDefenseRow =
    [...defenseCandidates].sort((a, b) => {
      const diff = a.goalsAgainst - b.goalsAgainst;
      if (diff !== 0) return diff;
      const perMatch =
        (a.goalsAgainst / (a.matchesPlayed || 1)) - (b.goalsAgainst / (b.matchesPlayed || 1));
      if (perMatch !== 0) return perMatch;
      return b.matchesPlayed - a.matchesPlayed;
    })[0] || null;

  const selectedIds = Array.from(
    new Set(
      [
        bestTeamRow && bestTeamRow.teamId,
        longestUnbeatenRow && longestUnbeatenRow.row.teamId,
        bestAttackRow && bestAttackRow.teamId,
        bestDefenseRow && bestDefenseRow.teamId,
      ].filter(Boolean)
    )
  );
  const enriched = await enrichTopTeamRankEntries(
    selectedIds.map((teamId) => ({
      teamId,
      teamName: (teams.get(teamId) || {}).teamName || 'Time',
    }))
  );
  const enrichedById = new Map(enriched.map((entry) => [entry.teamId, entry]));
  const teamIdentity = (teamId) => {
    const entry = enrichedById.get(teamId) || {};
    return {
      teamId,
      teamName: entry.teamName || (teams.get(teamId) || {}).teamName || 'Time',
      shieldImageUrl: entry.shieldImageUrl,
      presidentId: entry.presidentId || '',
      presidentName: entry.presidentName || '',
      presidentAvatarUrl: entry.presidentAvatarUrl,
    };
  };

  // Artilheiro do melhor ataque e defensor do melhor defesa (lote unico de usuarios).
  let topScorerEntry = null;
  if (bestAttackRow) {
    const sorted = Array.from(bestAttackRow.goalsByUser.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length && sorted[0][1] > 0) {
      topScorerEntry = { userId: sorted[0][0], goals: sorted[0][1] };
    }
  }

  let topDefenderEntry = null;
  if (bestDefenseRow && bestDefenseRow.pointsByUser.size) {
    const defenderIds = await loadTeamMatchDefenderUserIds(
      Array.from(bestDefenseRow.pointsByUser.keys())
    );
    const sorted = Array.from(bestDefenseRow.pointsByUser.entries())
      .filter(([userId]) => defenderIds.has(userId))
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      topDefenderEntry = { userId: sorted[0][0], points: sorted[0][1] };
    }
  }

  const personById = await loadTeamMatchPersonDisplayById([
    topScorerEntry && topScorerEntry.userId,
    topDefenderEntry && topDefenderEntry.userId,
  ]);
  const personOf = (userId) => personById.get(userId) || { name: '', avatarUrl: '' };

  return {
    teamRows: withRate.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      matchesPlayed: row.matchesPlayed,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      winRatePercent: row.winRatePercent,
    })),
    bestTeam: bestTeamRow
      ? {
          ...teamIdentity(bestTeamRow.teamId),
          matchesPlayed: bestTeamRow.matchesPlayed,
          wins: bestTeamRow.wins,
          draws: bestTeamRow.draws,
          losses: bestTeamRow.losses,
          winRatePercent: bestTeamRow.winRatePercent,
        }
      : null,
    longestUnbeaten: longestUnbeatenRow
      ? {
          ...teamIdentity(longestUnbeatenRow.row.teamId),
          unbeatenDays: longestUnbeatenRow.unbeatenDays,
          unbeatenLabel: longestUnbeatenRow.unbeatenLabel,
          matchesInStreak: longestUnbeatenRow.matchesInStreak,
          sinceStartTime: longestUnbeatenRow.sinceStartTime.toISOString(),
        }
      : null,
    bestAttack: bestAttackRow
      ? {
          ...teamIdentity(bestAttackRow.teamId),
          goalsFor: bestAttackRow.goalsFor,
          matchesPlayed: bestAttackRow.matchesPlayed,
          goalsPerMatch: teamMatchRoundOneDecimal(
            bestAttackRow.goalsFor / (bestAttackRow.matchesPlayed || 1)
          ),
          topScorer: topScorerEntry
            ? {
                userId: topScorerEntry.userId,
                name: personOf(topScorerEntry.userId).name || 'Atleta',
                avatarUrl: personOf(topScorerEntry.userId).avatarUrl || '',
                goals: topScorerEntry.goals,
                goalsPerMatch: teamMatchRoundOneDecimal(
                  topScorerEntry.goals / (bestAttackRow.matchesPlayed || 1)
                ),
              }
            : null,
        }
      : null,
    bestDefense: bestDefenseRow
      ? {
          ...teamIdentity(bestDefenseRow.teamId),
          goalsAgainst: bestDefenseRow.goalsAgainst,
          matchesPlayed: bestDefenseRow.matchesPlayed,
          goalsAgainstPerMatch: teamMatchRoundOneDecimal(
            bestDefenseRow.goalsAgainst / (bestDefenseRow.matchesPlayed || 1)
          ),
          topDefender: topDefenderEntry
            ? {
                userId: topDefenderEntry.userId,
                name: personOf(topDefenderEntry.userId).name || 'Atleta',
                avatarUrl: personOf(topDefenderEntry.userId).avatarUrl || '',
                points: teamMatchRoundOneDecimal(topDefenderEntry.points),
                pointsPerMatch: teamMatchRoundOneDecimal(
                  topDefenderEntry.points / (bestDefenseRow.matchesPlayed || 1)
                ),
              }
            : null,
        }
      : null,
  };
}

Parse.Cloud.define('getMuralTeamMatchDashboard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const locationFilter =
    typeof normalizeMuralLocationFilter === 'function'
      ? normalizeMuralLocationFilter(request.params)
      : { state: '', city: '', neighborhood: '', active: false };

  const candidateQuery = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .lessThan('startTime', new Date())
    .descending('startTime')
    .limit(500);
  if (locationFilter.active && typeof applyMuralLocationFilterToEventQuery === 'function') {
    candidateQuery.exists('address');
    applyMuralLocationFilterToEventQuery(candidateQuery, locationFilter);
  }
  const candidateEvents = await candidateQuery.find({ useMasterKey: true });
  const finishedEvents = [];
  for (const event of candidateEvents) {
    if (await eventCountsForTeamMatchRanking(event)) {
      finishedEvents.push(event);
    }
  }

  const totalConfrontos = finishedEvents.length;
  const locationStats = buildEventLocationStats(finishedEvents);

  const spotlightEvents = finishedEvents.slice(0, TEAM_MATCH_SPOTLIGHT_EVENT_LIMIT);
  const performanceRaw = await findRowsForEvents('EventPerformance', spotlightEvents);

  const spotlight = await buildTeamMatchSpotlightCards(spotlightEvents, performanceRaw);

  let teamRecords;
  if (locationFilter.active) {
    // Com recorte de regiao os registros vem da agregacao dos confrontos filtrados.
    teamRecords = spotlight.teamRows;
  } else {
    const teams = await new Parse.Query('AmateurTeam').limit(300).find({ useMasterKey: true });
    teamRecords = [];
    for (const team of teams) {
      const record = await computeAmateurTeamMatchRecord(team.id, 500);
      if (!record.matchesPlayed) continue;
      teamRecords.push({
        teamId: team.id,
        teamName: team.get('name') || 'Time',
        ...record,
      });
    }
  }

  const pickTeamExtreme = (field, preferHigh) => {
    const sorted = [...teamRecords].sort((a, b) =>
      preferHigh ? b[field] - a[field] : a[field] - b[field]
    );
    return sorted[0] || null;
  };

  const teamHighlights = {
    mostMatches: pickTeamExtreme('matchesPlayed', true),
    mostWins: pickTeamExtreme('wins', true),
    mostLosses: pickTeamExtreme('losses', true),
    mostDraws: pickTeamExtreme('draws', true),
    bestWinRate: [...teamRecords].sort((a, b) => b.winRatePercent - a.winRatePercent)[0] || null,
  };

  const performanceRows =
    typeof mapPerformanceRowsForMural === 'function'
      ? await mapPerformanceRowsForMural('app', undefined, performanceRaw)
      : [];
  const teamMatchPerfRows =
    typeof normalizePerformanceScoresForBucket === 'function'
      ? normalizePerformanceScoresForBucket(performanceRows, 'teamMatch')
      : performanceRows;

  const voteRows =
    typeof mapMuralVoteRowsForScope === 'function'
      ? await mapMuralVoteRowsForScope('app', undefined, locationFilter)
      : [];
  const teamMatchVoteRows =
    typeof filterVoteRowsByEventBucket === 'function' && typeof unweightVoteRows === 'function'
      ? unweightVoteRows(filterVoteRowsByEventBucket(voteRows, 'teamMatch'))
      : voteRows;

  let rankingsTeamMatch =
    typeof buildPeladaMuralRankings === 'function'
      ? buildPeladaMuralRankings(teamMatchPerfRows, teamMatchVoteRows, 10)
      : { athlete: [], goalkeeper: [], referee: [] };
  if (typeof enrichMuralRankingNames === 'function') {
    rankingsTeamMatch = await enrichMuralRankingNames('app', undefined, rankingsTeamMatch);
  }
  if (typeof finalizeEventGoalkeeperRankings === 'function') {
    rankingsTeamMatch = await finalizeEventGoalkeeperRankings(rankingsTeamMatch);
  }

  const topAthletes = (rankingsTeamMatch.athlete || []).slice(0, 10);
  const topGoalkeepers = (rankingsTeamMatch.goalkeeper || []).slice(0, 10);
  const topReferees = (rankingsTeamMatch.referee || []).slice(0, 10);

  const topScorers =
    typeof buildPerformanceTopEntries === 'function'
      ? buildPerformanceTopEntries(performanceRaw, 'goals', 10)
      : [];
  const topAssists =
    typeof buildPerformanceTopEntries === 'function'
      ? buildPerformanceTopEntries(performanceRaw, 'assists', 10)
      : [];
  const topPasses =
    typeof buildPerformanceTopEntries === 'function'
      ? buildPerformanceTopEntries(performanceRaw, 'passesCompleted', 10)
      : [];

  let topTeams = [];
  if (locationFilter.active) {
    // Reaproveita a agregacao filtrada em vez de varrer todos os times do app.
    const ranked = teamRecords
      .map((row) => ({
        ...row,
        combinedScore: teamMatchStandingPoints(row.wins, row.draws),
        totalScore: teamMatchStandingPoints(row.wins, row.draws),
      }))
      .sort((a, b) => {
        const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
        if (diff !== 0) return diff;
        return (b.winRatePercent || 0) - (a.winRatePercent || 0);
      });
    topTeams = await enrichTopTeamRankEntries(sliceTopRankWithTies(ranked, 10));
  } else if (typeof buildTopTeamsByMatchPoints === 'function') {
    topTeams = await buildTopTeamsByMatchPoints(10);
  }
  const topCoaches =
    typeof buildTopCoachesByMatchPoints === 'function' ? await buildTopCoachesByMatchPoints(10) : [];

  return {
    totalConfrontos,
    locationStats,
    teamHighlights,
    topAthletes,
    topGoalkeepers,
    topReferees,
    topScorers,
    topAssists,
    topPasses,
    topTeams,
    topCoaches,
    appliedLocation: {
      state: locationFilter.state,
      city: locationFilter.city,
      neighborhood: locationFilter.neighborhood,
    },
    bestTeam: spotlight.bestTeam,
    longestUnbeaten: spotlight.longestUnbeaten,
    bestAttack: spotlight.bestAttack,
    bestDefense: spotlight.bestDefense,
  };
});

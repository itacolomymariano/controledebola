/** Mural — votos, rankings, dashboards, perfis e analytics */

// Motor de votos e rankings
const MURAL_TARGET_ROLES = [
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
  'fan',
  'gatekeeper',
];

function isGoalkeeperPosition(position) {
  return String(position || '').trim().toLowerCase() === 'goleiro';
}

async function loadGoalkeeperUserIdsForMuralScope(scope, scopeId) {
  const ids = new Set();

  async function addFromEventRegistrations(eventIds) {
    for (const eventId of eventIds) {
      const event = Parse.Object.extend('Event').createWithoutData(eventId);
      const registrations = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .include('athlete')
        .limit(500)
        .find({ useMasterKey: true });

      for (const registration of registrations) {
        const resolved = await resolveRegistrationParticipantUserId(registration);
        if (!resolved.userId) continue;

        const role = registration.get('role') || 'athlete';
        const athlete = registration.get('athlete');
        const position =
          registration.get('primaryPosition') ||
          (athlete && athlete.get ? athlete.get('primaryPosition') : '');
        if (role === 'goalkeeper' || (role === 'athlete' && isGoalkeeperPosition(position))) {
          ids.add(String(resolved.userId));
        }
      }
    }
  }

  if (scope === 'event' && scopeId) {
    await addFromEventRegistrations([scopeId]);
    return ids;
  }

  if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    const eventIds = events.map((event) => event.id).filter(Boolean);
    await addFromEventRegistrations(eventIds);
    return ids;
  }

  const profiles = await new Parse.Query('AthleteProfile').limit(5000).find({ useMasterKey: true });
  for (const profile of profiles) {
    if (!isGoalkeeperPosition(profile.get('primaryPosition'))) continue;
    const user = profile.get('user');
    if (user && user.id) ids.add(String(user.id));
  }

  return ids;
}

function normalizeVoteRowTargetRole(voteRow, goalkeeperUserIds) {
  const role = voteRow.targetRole || 'athlete';
  if (role === 'athlete' && goalkeeperUserIds.has(voteRow.targetUserId)) {
    return { ...voteRow, targetRole: 'goalkeeper' };
  }
  return voteRow;
}

/** Uma nota por usuario (voter) por alvo/papel/periodo — evita contagem por perfil duplicado. */
function dedupeMuralVoteRowsByVoter(voteRows) {
  const byKey = new Map();
  for (const vote of voteRows) {
    if (!vote.targetUserId) continue;
    const voterKey = vote.voterId || `anon:${vote.targetUserId}:${vote.score}`;
    const key = `${voterKey}|${vote.targetUserId}|${vote.targetRole || 'athlete'}|${vote.period || ''}`;
    byKey.set(key, vote);
  }
  return Array.from(byKey.values());
}

/** Confrontos (team_match) pesam 3x em votacao/pontuacao agregada do mural. */
const TEAM_MATCH_MURAL_WEIGHT = 3;

/** Mural do app: ranking de craque/goleiro com confianca estatistica (fase anticorrupcao). */
const APP_MURAL_RANKING_PRIOR_WEIGHT = 5;
const APP_MURAL_RANKING_PRIOR_MEAN = 7.5;
const APP_MURAL_MIN_DISTINCT_VOTERS_FOR_FULL_WEIGHT = 3;
const EVENT_MURAL_MAX_SCORE_TEN_COUNT = 2;

function distinctVoterCountByTargetKey(voteRows) {
  const map = new Map();
  for (const vote of dedupeMuralVoteRowsByVoter(voteRows)) {
    if (!vote.targetUserId || !vote.voterId) continue;
    const key = `${vote.targetUserId}:${vote.targetRole || 'athlete'}`;
    const set = map.get(key) || new Set();
    set.add(String(vote.voterId));
    map.set(key, set);
  }
  const out = new Map();
  for (const [key, set] of map) out.set(key, set.size);
  return out;
}

function athleteAppConfidenceRankingScore(entry, distinctVoters) {
  const voteCount = Number(entry.voteCount || 0);
  const avg = Number(entry.averageScore || 0);
  if (voteCount <= 0) {
    return Number(entry.rankingScore ?? entry.combinedScore ?? entry.totalScore ?? 0);
  }
  const shrunk =
    (voteCount * avg + APP_MURAL_RANKING_PRIOR_WEIGHT * APP_MURAL_RANKING_PRIOR_MEAN) /
    (voteCount + APP_MURAL_RANKING_PRIOR_WEIGHT);
  const diversity =
    distinctVoters >= APP_MURAL_MIN_DISTINCT_VOTERS_FOR_FULL_WEIGHT
      ? 1
      : distinctVoters / APP_MURAL_MIN_DISTINCT_VOTERS_FOR_FULL_WEIGHT;
  return shrunk * diversity;
}

function applyAppMuralRankingConfidence(rankings, voteRowsForScope, topN = 10) {
  const distinctByKey = distinctVoterCountByTargetKey(voteRowsForScope);
  const result = { ...rankings };
  for (const role of ['athlete', 'goalkeeper']) {
    const list = [...(rankings[role] || [])];
    list.sort((a, b) => {
      const keyA = `${a.userId}:${role}`;
      const keyB = `${b.userId}:${role}`;
      const scoreA = athleteAppConfidenceRankingScore(a, distinctByKey.get(keyA) || 0);
      const scoreB = athleteAppConfidenceRankingScore(b, distinctByKey.get(keyB) || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
      if (voteDiff !== 0) return voteDiff;
      return (b.averageScore || 0) - (a.averageScore || 0);
    });
    result[role] = list.slice(0, topN).map((entry) => {
      const distinctVoterCount = distinctByKey.get(`${entry.userId}:${role}`) || 0;
      return {
        ...entry,
        distinctVoterCount,
        confidenceRankingScore: athleteAppConfidenceRankingScore(entry, distinctVoterCount),
      };
    });
  }
  return result;
}

function assertEventMuralBallotScoreTenLimit(entries) {
  const tens = entries.filter((entry) => Number(entry.score) === 10).length;
  if (tens > EVENT_MURAL_MAX_SCORE_TEN_COUNT) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Voce so pode dar nota 10 para no maximo ${EVENT_MURAL_MAX_SCORE_TEN_COUNT} jogadores neste evento.`
    );
  }
}

async function attachTeamMatchVoteWeights(voteRows) {
  const eventIds = [
    ...new Set(
      voteRows
        .map((vote) => String(vote.scopeId || '').trim())
        .filter(Boolean)
    ),
  ];
  if (!eventIds.length) return voteRows;
  const typeById = new Map();
  const chunkSize = 50;
  for (let i = 0; i < eventIds.length; i += chunkSize) {
    const chunk = eventIds.slice(i, i + chunkSize);
    const events = await new Parse.Query('Event')
      .containedIn('objectId', chunk)
      .select(['type'])
      .limit(chunk.length)
      .find({ useMasterKey: true });
    for (const event of events) {
      typeById.set(event.id, event.get('type') || '');
    }
  }
  for (const vote of voteRows) {
    const type = typeById.get(String(vote.scopeId || '')) || '';
    const weight = type === 'team_match' ? TEAM_MATCH_MURAL_WEIGHT : 1;
    vote.scoreWeight = weight;
    vote.weightedScore = Number(vote.score || 0) * weight;
  }
  return voteRows;
}

async function mapMuralVoteRowsForScope(scope, scopeId, locationFilter) {
  const goalkeeperUserIds = await loadGoalkeeperUserIdsForMuralScope(scope, scopeId);
  const rawVotes = await loadMuralVoteRows(scope, scopeId, locationFilter);
  const mapped = rawVotes.map((vote) =>
    normalizeVoteRowTargetRole(mapVoteRow(vote), goalkeeperUserIds)
  );
  const deduped = dedupeMuralVoteRowsByVoter(mapped);
  if (scope === 'event') return deduped;
  return attachTeamMatchVoteWeights(deduped);
}

function assertEventVotingWindowOpen(event) {
  const startTime = event.get('startTime');
  const opensAt = event.get('votingOpensAt') || startTime;
  let closesAt = event.get('votingClosesAt');
  if (!closesAt && startTime) {
    closesAt = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
  }
  const now = new Date();
  if (opensAt && now < opensAt) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'A votacao ainda nao esta aberta.');
  }
  if (closesAt && now >= closesAt) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'A votacao deste evento ja encerrou.');
  }
}

function computePerformanceScoreFromRow(perf) {
  const points = Number(perf.get('points') || 0);
  const goals = Number(perf.get('goals') || 0);
  const assists = Number(perf.get('assists') || 0);
  const saves = Number(perf.get('saves') || 0);
  const yellowCards = Number(perf.get('yellowCards') || 0);
  const redCards = Number(perf.get('redCards') || 0);
  return points + goals * 3 + assists * 2 + saves * 2 - yellowCards - redCards * 3;
}

async function loadMuralVoteRows(scope, scopeId, locationFilter) {
  if (scope === 'app') {
    if (locationFilter && locationFilter.active) {
      const eventIds = await loadMuralLocationEventIds(locationFilter);
      return loadMuralVoteRowsForEventIds(eventIds);
    }
    const query = new Parse.Query('MuralVote');
    query.include(['targetUser', 'voter']);
    query.limit(10000);
    return query.find({ useMasterKey: true });
  }

  if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    const eventIds = events.map((event) => event.id).filter(Boolean);

    const peladaVoteQuery = new Parse.Query('MuralVote');
    peladaVoteQuery.equalTo('scope', 'pelada');
    peladaVoteQuery.equalTo('scopeId', scopeId);

    const queries = [peladaVoteQuery];
    if (eventIds.length) {
      const eventVoteQuery = new Parse.Query('MuralVote');
      eventVoteQuery.equalTo('scope', 'event');
      eventVoteQuery.containedIn('scopeId', eventIds);
      queries.push(eventVoteQuery);
    }

    const combined = Parse.Query.or(...queries);
    combined.include(['targetUser', 'voter']);
    combined.limit(3000);
    return combined.find({ useMasterKey: true });
  }

  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', scope);
  if (scopeId) {
    query.equalTo('scopeId', scopeId);
  } else {
    query.doesNotExist('scopeId');
  }
  query.include(['targetUser', 'voter']);
  query.limit(3000);
  return query.find({ useMasterKey: true });
}

async function loadMuralPerformanceRows(scope, scopeId, locationFilter) {
  if (scope === 'app') {
    const query = new Parse.Query('EventPerformance');
    if (locationFilter && locationFilter.active) {
      query.matchesQuery('event', buildMuralLocationEventQuery(locationFilter));
    }
    return query.limit(3000).find({ useMasterKey: true });
  }

  if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });

    const byPelada = new Parse.Query('EventPerformance');
    byPelada.equalTo('pelada', pelada);

    const queries = [byPelada];
    if (events.length) {
      const byEvent = new Parse.Query('EventPerformance');
      byEvent.containedIn('event', events);
      queries.push(byEvent);
    }

    const combined = Parse.Query.or(...queries);
    combined.limit(3000);
    return combined.find({ useMasterKey: true });
  }

  if (scope === 'event' && scopeId) {
    const event = Parse.Object.extend('Event').createWithoutData(scopeId);
    return new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .limit(3000)
      .find({ useMasterKey: true });
  }

  return [];
}

function mapPerformanceRow(perf, conflictMap = new Map(), scopeDefaultPriority) {
  const userId = getPerformanceParticipantId(perf);
  const user = perf.get('user');
  const priority = resolvePerformanceStatsPriority(perf, conflictMap, scopeDefaultPriority);
  const effective = resolveEffectivePerformanceStats(perf, priority);
  const event = perf.get('event');
  return {
    userId,
    userName:
      (user && user.get ? user.get('apelido') : '') ||
      (user && user.get ? user.get('name') : '') ||
      (user && user.getUsername ? user.getUsername() : '') ||
      'Usuario',
    role: perf.get('role') || 'athlete',
    score: computeEffectivePerformanceScore(perf, priority),
    goals: effective.goals,
    saves: effective.saves,
    eventId: event && event.id ? String(event.id) : '',
  };
}

async function attachTeamMatchPerformanceWeights(rows, applyWeight = true) {
  const eventIds = [
    ...new Set(rows.map((row) => String(row.eventId || '').trim()).filter(Boolean)),
  ];
  if (!eventIds.length) return rows;
  const typeById = new Map();
  for (let i = 0; i < eventIds.length; i += 50) {
    const chunk = eventIds.slice(i, i + 50);
    const events = await new Parse.Query('Event')
      .containedIn('objectId', chunk)
      .select(['type'])
      .limit(chunk.length)
      .find({ useMasterKey: true });
    for (const event of events) {
      typeById.set(event.id, event.get('type') || '');
    }
  }
  for (const row of rows) {
    const type = typeById.get(String(row.eventId || '')) || '';
    row.eventType = type === 'team_match' ? 'team_match' : type || 'pelada';
    if (type === 'team_match' && applyWeight) {
      row.score = Number(row.score || 0) * TEAM_MATCH_MURAL_WEIGHT;
    }
  }
  return rows;
}

async function mapPerformanceRowsForMural(scope, scopeId, performances) {
  let scopeDefaultPriority;
  if (scope === 'pelada' && scopeId) {
    scopeDefaultPriority = await loadPeladaStatsConflictSource(scopeId);
  }
  const conflictMap = await buildPeladaStatsConflictMapFromPerformances(performances);
  const rows = performances.map((perf) => mapPerformanceRow(perf, conflictMap, scopeDefaultPriority));
  return attachTeamMatchPerformanceWeights(rows, scope !== 'event');
}

function buildLocationStatsFromParticipantRows(participants) {
  const byCity = new Map();
  const byNeighborhood = new Map();
  let total = 0;

  for (const row of participants) {
    const address = row.address || {};
    const city = normalizeLocationLabel(address.city);
    const neighborhood = normalizeLocationLabel(address.neighborhood);
    const state = normalizeBrazilUfLabel(address.state);
    if (!city && !neighborhood) continue;
    total += 1;
    if (city) {
      const cityLabel = state ? `${city} - ${state}` : city;
      byCity.set(cityLabel, (byCity.get(cityLabel) || 0) + 1);
    }
    if (neighborhood) {
      const label = [neighborhood, city, state].filter(Boolean).join(' · ');
      byNeighborhood.set(label, (byNeighborhood.get(label) || 0) + 1);
    }
  }

  return {
    total,
    byState: [],
    byCity: sortLocationCounts(byCity),
    byNeighborhood: sortLocationCounts(byNeighborhood),
  };
}

function resolveRegistrationDisplayFields(registration, resolvedUserId) {
  const user = registration.get('user');
  const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
  const displayName =
    apelido ||
    (registration.get('userDisplayName') || '').trim() ||
    (registration.get('userFullName') || '').trim() ||
    (user && user.get ? (user.get('apelido') || '').trim() : '') ||
    (user && user.get ? (user.get('name') || '').trim() : '') ||
    'Participante';
  const avatarUrl = resolveStoredAvatarUrl(user, registration);
  return {
    userId: resolvedUserId,
    displayName,
    avatarUrl: avatarUrl || undefined,
  };
}

function applyEventMuralVoteSnapshot(vote, registration, resolvedUserId) {
  const display = resolveRegistrationDisplayFields(registration, resolvedUserId);
  vote.set('targetUserId', resolvedUserId);
  vote.set('targetDisplayName', display.displayName);
  if (display.avatarUrl) {
    vote.set('targetAvatarUrl', display.avatarUrl);
  } else {
    vote.unset('targetAvatarUrl');
  }
}

function buildMuralVoteACL(voterId) {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(false);
  acl.setPublicWriteAccess(false);
  if (voterId) {
    acl.setReadAccess(voterId, true);
    acl.setWriteAccess(voterId, true);
  }
  return acl;
}

function enrichRankingsWithParticipantMeta(rankings, participants) {
  const nameById = new Map();
  const avatarById = new Map();
  for (const row of participants) {
    if (!row.userId) continue;
    nameById.set(
      row.userId,
      row.apelido || row.userName || nameById.get(row.userId) || 'Participante'
    );
    if (row.avatarUrl) avatarById.set(row.userId, row.avatarUrl);
  }

  for (const role of MURAL_TARGET_ROLES) {
    rankings[role] = (rankings[role] || []).map((entry) => ({
      ...entry,
      userName: nameById.get(entry.userId) || entry.userName || 'Participante',
      avatarUrl: avatarById.get(entry.userId) || entry.avatarUrl,
    }));
  }
  return rankings;
}

async function backfillEventMuralVoteSnapshots(votes, eventId) {
  if (!votes.length || !eventId) return;

  const needsBackfill = votes.filter((vote) => !vote.get('targetDisplayName'));
  if (!needsBackfill.length) return;

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .limit(500)
    .find({ useMasterKey: true });

  const regByUserId = new Map();
  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      regByUserId.set(resolved.userId, registration);
    }
  }

  const toSave = [];
  for (const vote of needsBackfill) {
    const targetUser = vote.get('targetUser');
    const targetUserId = String(
      vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
    );
    const registration = regByUserId.get(targetUserId);
    if (!registration || !targetUserId) continue;
    applyEventMuralVoteSnapshot(vote, registration, targetUserId);
    if (!vote.getACL()) {
      const voter = vote.get('voter');
      const voterId = voter && voter.id ? voter.id : '';
      if (voterId) {
        vote.setACL(buildMuralVoteACL(voterId));
      }
    }
    toSave.push(vote);
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }
}

async function listMyEventMuralVoteRows(eventId, voterId) {
  const voter = Parse.User.createWithoutData(voterId);
  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', 'event');
  query.equalTo('scopeId', eventId);
  query.equalTo('period', eventId);
  query.equalTo('voter', voter);
  query.limit(500);
  const votes = await query.find({ useMasterKey: true });
  await backfillEventMuralVoteSnapshots(votes, eventId);
  return votes;
}

function mapMyEventMuralVoteRow(vote, participantById) {
  const targetUser = vote.get('targetUser');
  const targetUserId = String(
    vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
  );
  const participant = participantById.get(targetUserId);
  const targetUserName =
    vote.get('targetDisplayName') ||
    (participant && participant.apelido) ||
    (participant && participant.userName) ||
    'Participante';
  const targetAvatarUrl = vote.get('targetAvatarUrl') || (participant && participant.avatarUrl);
  return {
    objectId: vote.id,
    scope: 'event',
    scopeId: vote.get('scopeId') || '',
    voterId: vote.get('voter') && vote.get('voter').id ? vote.get('voter').id : '',
    targetUserId,
    targetUserName,
    targetAvatarUrl: targetAvatarUrl || undefined,
    targetRole: vote.get('targetRole') || 'athlete',
    score: Number(vote.get('score') || 0),
    period: vote.get('period') || '',
    createdAt: vote.get('createdAt') ? vote.get('createdAt').toISOString() : new Date().toISOString(),
  };
}

function mapVoteRow(vote) {
  const voter = vote.get('voter');
  const targetUser = vote.get('targetUser');
  const targetUserId = String(
    vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
  );
  return {
    voterId: voter && voter.id ? String(voter.id) : '',
    targetUserId,
    targetUserName:
      vote.get('targetDisplayName') ||
      (targetUser && targetUser.get ? targetUser.get('apelido') : '') ||
      (targetUser && targetUser.get ? targetUser.get('name') : '') ||
      (targetUser && targetUser.getUsername ? targetUser.getUsername() : '') ||
      'Participante',
    targetRole: vote.get('targetRole') || 'athlete',
    score: Number(vote.get('score') || 0),
    period: vote.get('period') || '',
    scopeId: String(vote.get('scopeId') || ''),
    scoreWeight: 1,
  };
}

function muralRankingDisplayScore(entry) {
  const voteCount = Number(entry.voteCount || 0);
  const totalScore = Number(entry.totalScore || 0);
  const combinedScore = Number(entry.combinedScore || 0);
  return voteCount > 0 ? totalScore : combinedScore;
}

/** Nota exibida na badge do Top 10 Atletas (averageScore quando há votos). */
function athleteDisplayNote(entry) {
  if (Number(entry.voteCount || 0) > 0) return Number(entry.averageScore || 0);
  return Number(entry.combinedScore || 0);
}

function buildMuralRankingsFromData(performances, votes, topN = 10) {
  const perfScores = new Map();
  const perfMeta = new Map();
  for (const perf of performances) {
    if (!perf.userId) continue;
    const key = `${perf.userId}:${perf.role}`;
    perfScores.set(key, (perfScores.get(key) || 0) + perf.score);
    if (!perfMeta.has(key)) perfMeta.set(key, perf);
  }

  const voteAgg = new Map();
  for (const vote of dedupeMuralVoteRowsByVoter(votes)) {
    if (!vote.targetUserId) continue;
    const key = `${vote.targetUserId}:${vote.targetRole}`;
    const current = voteAgg.get(key) || { total: 0, count: 0, weightSum: 0 };
    const weight = Number(vote.scoreWeight || 1) || 1;
    const weighted = Number(vote.weightedScore != null ? vote.weightedScore : vote.score * weight);
    current.total += weighted;
    current.count += 1;
    current.weightSum += weight;
    voteAgg.set(key, current);
  }

  const result = {};
  for (const role of MURAL_TARGET_ROLES) {
    const userIds = new Set();
    for (const perf of performances) {
      if (perf.role === role && perf.userId) userIds.add(perf.userId);
    }
    for (const vote of votes) {
      if (vote.targetRole === role && vote.targetUserId) userIds.add(vote.targetUserId);
    }

    const entries = [];
    for (const userId of userIds) {
      const perfKey = `${userId}:${role}`;
      const performanceScore = perfScores.get(perfKey) || 0;
      const voteData = voteAgg.get(perfKey) || { total: 0, count: 0, weightSum: 0 };
      if (voteData.count === 0 && performanceScore === 0) continue;
      const averageScore =
        voteData.weightSum > 0
          ? voteData.total / voteData.weightSum
          : voteData.count > 0
            ? voteData.total / voteData.count
            : 0;
      const combinedScore = performanceScore + averageScore * 10;
      const perf = perfMeta.get(perfKey);
      const vote = votes.find((row) => row.targetUserId === userId && row.targetRole === role);
      entries.push({
        userId,
        userName: (perf && perf.userName) || (vote && vote.targetUserName) || 'Usuario',
        role,
        totalScore: voteData.total,
        voteCount: voteData.count,
        averageScore,
        performanceScore,
        combinedScore,
      });
    }

    entries.sort((a, b) => {
      if (role === 'goalkeeper') {
        const scoreDiff = (b.totalScore || 0) - (a.totalScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
      }
      if (role === 'athlete') {
        const noteDiff = athleteDisplayNote(b) - athleteDisplayNote(a);
        if (noteDiff !== 0) return noteDiff;
        const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
        if (voteDiff !== 0) return voteDiff;
        return (b.combinedScore || 0) - (a.combinedScore || 0);
      }
      return b.combinedScore - a.combinedScore;
    });
    result[role] = entries.slice(0, topN);
  }

  return result;
}

/** Perfis de apoio: media das notas por evento / qtd de eventos com nota. */
const SUPPORT_MURAL_ROLES = [
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
  'fan',
  'gatekeeper',
];

function isSupportMuralRole(role) {
  return SUPPORT_MURAL_ROLES.indexOf(role) >= 0;
}

/**
 * Media das notas por evento (media de cada evento / qtd de eventos com nota).
 * Usado no mural da pelada e do app para perfis de apoio.
 */
function buildSupportRoleAverageByEventRankings(voteRows, topN = 10) {
  const deduped = dedupeMuralVoteRowsByVoter(voteRows);
  const result = {};

  for (const role of SUPPORT_MURAL_ROLES) {
    const byUser = new Map();
    for (const vote of deduped) {
      if (vote.targetRole !== role || !vote.targetUserId) continue;
      const eventId = String(vote.scopeId || '').trim() || '_';
      let userData = byUser.get(vote.targetUserId);
      if (!userData) {
        userData = {
          userName: vote.targetUserName || 'Participante',
          events: new Map(),
          voteCount: 0,
        };
        byUser.set(vote.targetUserId, userData);
      }
      if (vote.targetUserName && vote.targetUserName !== 'Usuario') {
        userData.userName = vote.targetUserName;
      }
      const eventAgg = userData.events.get(eventId) || { sum: 0, count: 0, weightSum: 0 };
      const weight = Number(vote.scoreWeight || 1) || 1;
      const weighted = Number(vote.weightedScore != null ? vote.weightedScore : vote.score * weight);
      eventAgg.sum += weighted;
      eventAgg.count += 1;
      eventAgg.weightSum += weight;
      userData.events.set(eventId, eventAgg);
      userData.voteCount += 1;
    }

    const entries = Array.from(byUser.entries())
      .map(([userId, data]) => {
        const eventAverages = [];
        for (const eventAgg of data.events.values()) {
          if (eventAgg.weightSum > 0) {
            eventAverages.push(eventAgg.sum / eventAgg.weightSum);
          } else if (eventAgg.count > 0) {
            eventAverages.push(eventAgg.sum / eventAgg.count);
          }
        }
        const eventsParticipated = eventAverages.length;
        const averageScore =
          eventsParticipated > 0
            ? eventAverages.reduce((sum, value) => sum + value, 0) / eventsParticipated
            : 0;
        return {
          userId,
          userName: data.userName,
          role,
          totalScore: averageScore,
          voteCount: data.voteCount,
          averageScore,
          performanceScore: 0,
          combinedScore: averageScore,
          eventsParticipated,
        };
      })
      .filter((entry) => entry.eventsParticipated > 0)
      .sort((a, b) => {
        const avgDiff = (b.averageScore || 0) - (a.averageScore || 0);
        if (avgDiff !== 0) return avgDiff;
        return (b.voteCount || 0) - (a.voteCount || 0);
      })
      .slice(0, topN);

    result[role] = entries;
  }

  return result;
}

function buildPeladaMuralRankings(performances, voteRows, topN = 10) {
  const perfRankings = buildMuralRankingsFromData(performances, voteRows, topN);
  const voteRankings = buildEventVoteRankings(voteRows, topN);
  const supportAvgRankings = buildSupportRoleAverageByEventRankings(voteRows, topN);
  const result = {};

  for (const role of MURAL_TARGET_ROLES) {
    if (isSupportMuralRole(role)) {
      const supportList = supportAvgRankings[role] || [];
      if (supportList.length > 0) {
        result[role] = supportList;
        continue;
      }
    }

    const voteList = voteRankings[role] || [];
    if (voteList.length > 0) {
      result[role] = voteList.map((entry) => {
        const perfEntry = (perfRankings[role] || []).find((row) => row.userId === entry.userId);
        return {
          ...entry,
          userName: entry.userName || perfEntry?.userName || 'Participante',
          performanceScore: perfEntry?.performanceScore ?? entry.performanceScore ?? 0,
          averageScore: perfEntry?.averageScore ?? entry.averageScore ?? 0,
          voteCount: entry.voteCount ?? perfEntry?.voteCount ?? 0,
          combinedScore: perfEntry?.combinedScore ?? entry.totalScore,
        };
      });
      continue;
    }

    result[role] = perfRankings[role] || [];
  }

  return result;
}

function resolveStoredAvatarUrl(user, registration) {
  const registrationAvatar = registration && registration.get ? registration.get('avatarUrl') : '';
  if (registrationAvatar && String(registrationAvatar).trim()) {
    return String(registrationAvatar).trim();
  }
  if (!user || !user.get) return undefined;
  const direct = (user.get('avatarUrl') || '').trim();
  if (direct) return direct;
  const avatar = user.get('avatar');
  if (avatar && typeof avatar.url === 'function') {
    return avatar.url();
  }
  if (avatar && avatar._url) return avatar._url;
  return undefined;
}

function buildEventVoteRankings(voteRows, topN = 10) {
  const deduped = dedupeMuralVoteRowsByVoter(voteRows);
  const result = {};
  for (const role of MURAL_TARGET_ROLES) {
    const agg = new Map();
    for (const vote of deduped) {
      if (vote.targetRole !== role || !vote.targetUserId) continue;
      const current = agg.get(vote.targetUserId) || {
        total: 0,
        count: 0,
        weightSum: 0,
        userName: vote.targetUserName || 'Participante',
      };
      const weight = Number(vote.scoreWeight || 1) || 1;
      const weighted = Number(vote.weightedScore != null ? vote.weightedScore : vote.score * weight);
      current.total += weighted;
      current.count += 1;
      current.weightSum += weight;
      if (vote.targetUserName && vote.targetUserName !== 'Usuario') {
        current.userName = vote.targetUserName;
      }
      agg.set(vote.targetUserId, current);
    }

    const entries = Array.from(agg.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        role,
        totalScore: data.total,
        voteCount: data.count,
        averageScore:
          data.weightSum > 0
            ? data.total / data.weightSum
            : data.count > 0
              ? data.total / data.count
              : 0,
        performanceScore: 0,
        combinedScore: data.total,
      }))
      .sort((a, b) => {
        if (role === 'goalkeeper') {
          const scoreDiff = (b.totalScore || 0) - (a.totalScore || 0);
          if (scoreDiff !== 0) return scoreDiff;
        }
        return b.totalScore - a.totalScore;
      })
      .slice(0, topN);

    result[role] = entries;
  }
  return result;
}

async function loadUserAgesForRanking(userIds) {
  const map = new Map();
  if (!userIds.length) return map;

  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    const users = await userQuery.find({ useMasterKey: true });
    for (const user of users) {
      const birthDate = user.get('birthDate');
      if (birthDate instanceof Date && !Number.isNaN(birthDate.getTime())) {
        map.set(user.id, calcAgeFromBirthDate(birthDate));
      }
    }
  }
  return map;
}

async function finalizeEventGoalkeeperRankings(rankings) {
  const entries = rankings.goalkeeper || [];
  if (entries.length <= 1) return rankings;

  const ageByUserId = await loadUserAgesForRanking(entries.map((entry) => entry.userId));
  entries.sort((a, b) => {
    const totalDiff = (b.totalScore || 0) - (a.totalScore || 0);
    if (totalDiff !== 0) return totalDiff;
    const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
    if (voteDiff !== 0) return voteDiff;
    return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
  });
  rankings.goalkeeper = entries;
  return rankings;
}

function muralRankingPrimarySort(a, b, role) {
  if (role === 'goalkeeper') {
    const totalDiff = (b.totalScore || 0) - (a.totalScore || 0);
    if (totalDiff !== 0) return totalDiff;
    const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
    if (voteDiff !== 0) return voteDiff;
    return 0;
  }
  if (role === 'athlete') {
    const noteDiff = athleteDisplayNote(b) - athleteDisplayNote(a);
    if (noteDiff !== 0) return noteDiff;
    const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
    if (voteDiff !== 0) return voteDiff;
    return (b.combinedScore || 0) - (a.combinedScore || 0);
  }
  const combinedDiff = (b.combinedScore || 0) - (a.combinedScore || 0);
  if (combinedDiff !== 0) return combinedDiff;
  const avgDiff = (b.averageScore || 0) - (a.averageScore || 0);
  if (avgDiff !== 0) return avgDiff;
  return (b.voteCount || 0) - (a.voteCount || 0);
}

async function finalizeMuralRankingsAgeTiebreak(rankings) {
  const userIds = new Set();
  for (const role of MURAL_TARGET_ROLES) {
    for (const entry of rankings[role] || []) {
      if (entry.userId) userIds.add(entry.userId);
    }
  }
  const ageByUserId = await loadUserAgesForRanking(Array.from(userIds));

  for (const role of MURAL_TARGET_ROLES) {
    const entries = rankings[role] || [];
    if (entries.length <= 1) continue;
    entries.sort((a, b) => {
      const primary = muralRankingPrimarySort(a, b, role);
      if (primary !== 0) return primary;
      return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
    });
    rankings[role] = entries;
  }
  return rankings;
}

function extractUserLocationKeys(user, includeState) {
  const address = user.get('address') || {};
  const state = normalizeBrazilUfLabel(address.state);
  const city = normalizeLocationLabel(address.city);
  const neighborhood = normalizeLocationLabel(address.neighborhood);

  return {
    state: includeState && state ? state : null,
    city: city ? (includeState && state ? `${city} - ${state}` : city) : null,
    neighborhood: neighborhood
      ? [neighborhood, city, includeState ? state : ''].filter(Boolean).join(' · ')
      : null,
  };
}

function buildMuralLocationTopRankingsFromUsers(users, fullRankings, includeState) {
  const byState = new Map();
  const byCity = new Map();
  const byNeighborhood = new Map();

  for (const user of users) {
    if (!user.id) continue;
    const keys = extractUserLocationKeys(user, includeState);
    if (keys.state) {
      if (!byState.has(keys.state)) byState.set(keys.state, new Set());
      byState.get(keys.state).add(user.id);
    }
    if (keys.city) {
      if (!byCity.has(keys.city)) byCity.set(keys.city, new Set());
      byCity.get(keys.city).add(user.id);
    }
    if (keys.neighborhood) {
      if (!byNeighborhood.has(keys.neighborhood)) {
        byNeighborhood.set(keys.neighborhood, new Set());
      }
      byNeighborhood.get(keys.neighborhood).add(user.id);
    }
  }

  const buildGroups = (groupsMap) => {
    const result = [];
    for (const [label, userIds] of groupsMap) {
      if (userIds.size < 3) continue;
      const rankings = {};
      for (const role of MURAL_TARGET_ROLES) {
        rankings[role] = (fullRankings[role] || [])
          .filter((entry) => {
            if (!userIds.has(entry.userId) || muralRankingDisplayScore(entry) <= 0) {
              return false;
            }
            const votes = Number(entry.voteCount || 0);
            // Com votos, exige quórum no papel; ranking so de desempenho (0 votos) segue.
            if (votes > 0 && votes < INTEGRITY_MIN_LOCATION_ROLE_VOTES) {
              return false;
            }
            return true;
          })
          .sort((a, b) => muralRankingDisplayScore(b) - muralRankingDisplayScore(a))
          .slice(0, 3);
      }
      result.push({
        label,
        participantCount: userIds.size,
        rankings,
      });
    }
    return result.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  };

  return {
    byState: includeState ? buildGroups(byState) : [],
    byCity: buildGroups(byCity),
    byNeighborhood: buildGroups(byNeighborhood),
  };
}

async function loadEventMuralParticipantRows(eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .limit(500)
    .find({ useMasterKey: true });

  const byUser = {};
  const toSave = [];

  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;
    if (resolved.shouldSave) toSave.push(registration);

    const role = registration.get('role') || 'athlete';
    const user = registration.get('user');
    const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
    const userName =
      apelido ||
      (registration.get('userDisplayName') || '').trim() ||
      (registration.get('userFullName') || '').trim() ||
      (user && user.get ? (user.get('apelido') || '').trim() : '') ||
      (user && user.get ? (user.get('name') || '').trim() : '') ||
      'Participante';
    const birthDate = user && user.get ? user.get('birthDate') : undefined;
    const address = user && user.get ? user.get('address') : undefined;
    const avatarUrl = resolveStoredAvatarUrl(user, registration);
    const favoriteProTeam =
      user && user.get
        ? readUserFavoriteProTeam(user)
        : undefined;
    const favoriteAmateurTeam =
      user && user.get
        ? readUserFavoriteAmateurTeam(user)
        : undefined;

    if (!byUser[resolved.userId]) {
      byUser[resolved.userId] = {
        userId: resolved.userId,
        userName,
        apelido,
        fullName:
          (registration.get('userFullName') || '').trim() ||
          (user && user.get ? (user.get('name') || '').trim() : '') ||
          '',
        roles: [role],
        avatarUrl,
        birthDate: birthDate ? birthDate.toISOString() : undefined,
        address: address || undefined,
        favoriteProTeam: favoriteProTeam || undefined,
        favoriteAmateurTeam: favoriteAmateurTeam || undefined,
        proFootballIdol:
          user && user.get ? (user.get('proFootballIdol') || '').trim() || undefined : undefined,
        amateurFootballIdol:
          user && user.get ? (user.get('amateurFootballIdol') || '').trim() || undefined : undefined,
      };
    } else {
      if (!byUser[resolved.userId].roles.includes(role)) {
        byUser[resolved.userId].roles.push(role);
      }
      if (!byUser[resolved.userId].avatarUrl && avatarUrl) {
        byUser[resolved.userId].avatarUrl = avatarUrl;
      }
      if (!byUser[resolved.userId].apelido && apelido) {
        byUser[resolved.userId].apelido = apelido;
      }
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  const userIdList = Object.keys(byUser);
  if (userIdList.length) {
    const users = userIdList.map((id) => Parse.User.createWithoutData(id));
    const athleteQuery = new Parse.Query('AthleteProfile');
    athleteQuery.containedIn('user', users);
    athleteQuery.limit(Math.min(userIdList.length, 500));
    const athleteProfiles = await athleteQuery.find({ useMasterKey: true });
    for (const athleteProfile of athleteProfiles) {
      const userPtr = athleteProfile.get('user');
      const uid = userPtr && userPtr.id ? String(userPtr.id) : '';
      if (!uid || !byUser[uid]) continue;
      const height = Number(athleteProfile.get('height') || 0);
      if (height > 0) {
        byUser[uid].heightCm = height;
      }
    }
  }

  return Object.values(byUser).sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
}

async function enrichMuralRankingNames(scope, scopeId, result) {
  const userIds = new Set();
  for (const role of MURAL_TARGET_ROLES) {
    for (const entry of result[role] || []) {
      if (entry.userId) userIds.add(entry.userId);
    }
  }
  if (!userIds.size) return result;

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }
  const userById = new Map(users.map((user) => [user.id, user]));

  const registrationNames = new Map();
  const registrationAvatars = new Map();
  if (scope === 'event' && scopeId) {
    const event = Parse.Object.extend('Event').createWithoutData(scopeId);
    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .include('user')
      .limit(500)
      .find({ useMasterKey: true });
    for (const registration of registrations) {
      const resolved = await resolveRegistrationParticipantUserId(registration);
      if (!resolved.userId) continue;
      const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
      const displayName =
        apelido ||
        (registration.get('userDisplayName') || '').trim() ||
        (registration.get('userFullName') || '').trim();
      if (displayName) registrationNames.set(resolved.userId, displayName);
      const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
      if (avatarUrl) registrationAvatars.set(resolved.userId, avatarUrl);
    }
  } else if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    for (const event of events) {
      const registrations = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .include('user')
        .limit(500)
        .find({ useMasterKey: true });
      for (const registration of registrations) {
        const resolved = await resolveRegistrationParticipantUserId(registration);
        if (!resolved.userId) continue;
        const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
        const displayName =
          apelido ||
          (registration.get('userDisplayName') || '').trim() ||
          (registration.get('userFullName') || '').trim();
        if (displayName && !registrationNames.has(resolved.userId)) {
          registrationNames.set(resolved.userId, displayName);
        }
        const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
        if (avatarUrl && !registrationAvatars.has(resolved.userId)) {
          registrationAvatars.set(resolved.userId, avatarUrl);
        }
      }
    }
  }

  for (const role of MURAL_TARGET_ROLES) {
    result[role] = (result[role] || []).map((entry) => {
      const user = userById.get(entry.userId);
      const userName =
        registrationNames.get(entry.userId) ||
        (user && user.get('apelido')) ||
        (user && user.get('name')) ||
        (user && user.getUsername()) ||
        entry.userName ||
        'Participante';
      const avatarUrl =
        registrationAvatars.get(entry.userId) ||
        resolveStoredAvatarUrl(user) ||
        entry.avatarUrl;
      return {
        ...entry,
        userName,
        avatarUrl: avatarUrl || undefined,
      };
    });
  }

  return result;
}

function sumScoutTypedGoals(stats) {
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(stats[field] || 0);
  }
  return total;
}

function hasRefereeSumulaSaved(perf) {
  if (!perf || !perf.get) return false;
  if (perf.get('refereeSumulaSaved')) return true;
  if (perf.get('refereeObservation')) return true;
  if (Number(perf.get('refereeGoals') || 0) > 0) return true;
  if (Number(perf.get('refereeGoalsConceded') || 0) > 0) return true;
  if (Number(perf.get('refereeYellowCards') || 0) > 0) return true;
  if (Number(perf.get('refereeRedCards') || 0) > 0) return true;
  if (Number(perf.get('refereeFoulsCommitted') || 0) > 0) return true;
  return false;
}

function hasScoutApontamentoSaved(perf) {
  if (!perf || !perf.get) return false;
  if (perf.get('scoutApontamentoSaved')) return true;
  const stats = mapPerformanceToScoutStats(perf);
  if (Number(stats.goals || 0) > 0 || sumScoutTypedGoals(stats) > 0) return true;
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals') continue;
    if (Number(stats[field] || 0) > 0) return true;
  }
  return false;
}

function resolveEffectiveGoalsForCounting(perf, priority) {
  if (!perf || !perf.get) return 0;
  const scoutStats = mapPerformanceToScoutStats(perf);
  const refereeStats = mapPerformanceToRefereeSumula(perf);
  const scoutGoals = Math.max(
    Number(scoutStats.goals || 0),
    sumScoutTypedGoals(scoutStats)
  );
  const refereeGoals = Number(refereeStats.goals || 0);
  const legacyGoals = Number(perf.get('goals') || 0);
  const scoutSaved = hasScoutApontamentoSaved(perf);
  const refereeSaved = hasRefereeSumulaSaved(perf);
  const useScoutFirst = normalizeStatsConflictSource(priority) === 'scout';

  if (useScoutFirst) {
    if (scoutSaved) return scoutGoals;
    if (refereeSaved) return refereeGoals;
  } else {
    if (refereeSaved) return refereeGoals;
    if (scoutSaved) return scoutGoals;
  }
  return Math.max(scoutGoals, refereeGoals, legacyGoals);
}

function resolveMuralHighlightGoals(perf, priority) {
  return resolveEffectiveGoalsForCounting(perf, priority || 'referee');
}


// Perfis de participantes e times favoritos
async function collectMuralProfileUserIds(scope, scopeId, extraUserIds) {
  const ids = new Set();
  for (const id of extraUserIds || []) {
    if (id) ids.add(String(id));
  }

  if (scope === 'app') {
    const birthQuery = new Parse.Query(Parse.User);
    birthQuery.exists('birthDate');
    birthQuery.limit(5000);
    const usersWithBirth = await birthQuery.find({ useMasterKey: true });
    for (const user of usersWithBirth) {
      if (user.id) ids.add(user.id);
    }

    const voteRows = await loadMuralVoteRows('app');
    for (const vote of voteRows) {
      const targetUserId = vote.get('targetUserId');
      const targetUser = vote.get('targetUser');
      const userId = targetUserId || (targetUser && targetUser.id ? targetUser.id : '');
      if (userId) ids.add(String(userId));
    }

    const performances = await loadMuralPerformanceRows('app');
    for (const perf of performances) {
      const userId = getPerformanceParticipantId(perf);
      if (userId) ids.add(userId);
    }

    return ids;
  }

  if (scope === 'pelada' && scopeId) {
    const participantIds = await collectPeladaParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  if (scope === 'event' && scopeId) {
    const participantIds = await collectEventParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  return ids;
}

function buildMuralParticipantProfile(user, athleteProfile, amateurTeam, fanProfile) {
  const birthDate = user.get('birthDate');
  const age = calcAgeFromBirthDate(birthDate);
  const primaryRole = user.get('primaryRole');
  const athletePosition = athleteProfile ? athleteProfile.get('primaryPosition') : undefined;
  const profileLabels = {
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
    fan: 'Torcedor',
  };
  const profileLabel =
    athletePosition ||
    (primaryRole && profileLabels[primaryRole]) ||
    'Participante';
  const apelido = (user.get('apelido') || '').trim();
  const fullName = (user.get('name') || '').trim();

  return {
    userId: user.id,
    displayName: apelido || fullName || user.getUsername() || 'Participante',
    avatarUrl: user.get('avatarUrl') || undefined,
    profileLabel,
    isAthlete: !!athleteProfile,
    favoriteProTeam: readUserFavoriteProTeam(
      user,
      athleteProfile ? athleteProfile.get('favoriteProTeam') : undefined,
      fanProfile ? fanProfile.get('favoriteProTeam') : undefined
    ),
    favoriteAmateurTeam: readUserFavoriteAmateurTeam(
      user,
      amateurTeam ? amateurTeam.get('name') : undefined
    ),
    proFootballIdol: readUserProFootballIdol(user),
    amateurFootballIdol: readUserAmateurFootballIdol(user),
    birthDate: birthDate ? birthDate.toISOString() : undefined,
    age,
    ageBand: getAgeBandFromAge(age),
    heightCm:
      athleteProfile && Number(athleteProfile.get('height') || 0) > 0
        ? Number(athleteProfile.get('height'))
        : undefined,
  };
}

Parse.Cloud.define('getMuralParticipantProfiles', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const extraUserIds = Array.isArray(request.params.userIds) ? request.params.userIds : [];
  const userIds = await collectMuralProfileUserIds(scope, scopeId, extraUserIds);

  if (!userIds.size) {
    return [];
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.containedIn('user', users);
  athleteQuery.limit(users.length);
  const athletes = await athleteQuery.find({ useMasterKey: true });
  const athleteByUserId = new Map();
  for (const row of athletes) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) athleteByUserId.set(userPtr.id, row);
  }

  const fanQuery = new Parse.Query('FanProfile');
  fanQuery.containedIn('user', users);
  fanQuery.limit(users.length);
  const fans = await fanQuery.find({ useMasterKey: true });
  const fanByUserId = new Map();
  for (const row of fans) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) fanByUserId.set(userPtr.id, row);
  }

  const teamQuery = new Parse.Query('AmateurTeam');
  teamQuery.containedIn('president', users);
  teamQuery.limit(users.length);
  const teams = await teamQuery.find({ useMasterKey: true });
  const teamByPresidentId = new Map();
  for (const row of teams) {
    const president = row.get('president');
    if (president && president.id) teamByPresidentId.set(president.id, row);
  }

  return users
    .filter((user) => user.id)
    .map((user) =>
      buildMuralParticipantProfile(
        user,
        athleteByUserId.get(user.id),
        teamByPresidentId.get(user.id),
        fanByUserId.get(user.id)
      )
    );
});

Parse.Cloud.define('getFavoriteProTeamStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const extraUserIds = Array.isArray(request.params.userIds) ? request.params.userIds : [];
  const userIds = await collectMuralProfileUserIds(scope, scopeId, extraUserIds);

  if (!userIds.size) {
    return { teams: [], totalParticipants: 0 };
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.containedIn('user', users);
  athleteQuery.limit(users.length);
  const athletes = await athleteQuery.find({ useMasterKey: true });

  const fanQuery = new Parse.Query('FanProfile');
  fanQuery.containedIn('user', users);
  fanQuery.limit(users.length);
  const fans = await fanQuery.find({ useMasterKey: true });

  const legacyTeamByUserId = new Map();
  for (const row of athletes) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) {
      legacyTeamByUserId.set(userPtr.id, row.get('favoriteProTeam'));
    }
  }
  for (const row of fans) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id && !legacyTeamByUserId.has(userPtr.id)) {
      legacyTeamByUserId.set(userPtr.id, row.get('favoriteProTeam'));
    }
  }

  const userById = new Map(users.map((user) => [user.id, user]));
  const teamByUserId = new Map();
  for (const userId of userIds) {
    const user = userById.get(userId);
    const team = readUserFavoriteProTeam(user, legacyTeamByUserId.get(userId));
    if (team) teamByUserId.set(userId, team);
  }

  const counts = new Map();
  let totalParticipants = 0;
  for (const userId of userIds) {
    const teamName = normalizeLocationLabel(teamByUserId.get(userId) || '');
    if (!teamName || teamName.toLowerCase() === 'sem time') continue;
    totalParticipants += 1;
    counts.set(teamName, (counts.get(teamName) || 0) + 1);
  }

  const teams = Array.from(counts.entries())
    .map(([teamName, count]) => ({ teamName, count }))
    .sort((a, b) => {
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      return a.teamName.localeCompare(b.teamName, 'pt-BR');
    });

  return {
    teams,
    totalParticipants,
    favoriteTeam: teams.length ? teams[0] : null,
  };
});

// Estatisticas de localizacao
function normalizeLocationLabel(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Corrige UFs invalidas vindas de geocoding (ex.: Federal District → FE). */
function normalizeBrazilUfLabel(value) {
  const uf = normalizeLocationLabel(value).toUpperCase();
  if (uf === 'FE') return 'DF';
  return uf;
}

/* ---------- Filtro de regiao do mural (local do jogo: Event.address) ---------- */

const MURAL_LOCATION_EVENT_SCAN_LIMIT = 5000;

/** UFs gravadas no banco sem normalizacao (geocoding ja gerou 'FE' e minusculas). */
function muralLocationStateVariants(uf) {
  const normalized = normalizeBrazilUfLabel(uf);
  if (!normalized) return [];
  const variants = new Set([normalized, normalized.toLowerCase()]);
  if (normalized === 'DF') {
    variants.add('FE');
    variants.add('fe');
  }
  return Array.from(variants);
}

/** Cascata Estado > Cidade > Bairro: cidade exige UF e bairro exige cidade. */
function normalizeMuralLocationFilter(params) {
  const source = params || {};
  const state = normalizeBrazilUfLabel(source.state);
  const city = state ? normalizeLocationLabel(source.city) : '';
  const neighborhood = city ? normalizeLocationLabel(source.neighborhood) : '';
  return { state, city, neighborhood, active: !!state };
}

function applyMuralLocationFilterToEventQuery(query, filter) {
  if (!filter || !filter.active) return query;
  if (filter.state) {
    query.containedIn('address.state', muralLocationStateVariants(filter.state));
  }
  if (filter.city) {
    query.equalTo('address.city', filter.city);
  }
  if (filter.neighborhood) {
    query.equalTo('address.neighborhood', filter.neighborhood);
  }
  return query;
}

/** Eventos (pelada ou confronto) com endereco dentro do recorte. */
function buildMuralLocationEventQuery(filter) {
  const query = new Parse.Query('Event');
  query.exists('address');
  return applyMuralLocationFilterToEventQuery(query, filter);
}

/** Eventos que ja contam para o mural: encerrados ou com inicio no passado. */
function buildCountedEventQueryForLocation(filter) {
  const finishedQuery = new Parse.Query('Event').equalTo('isFinished', true);
  const startedQuery = new Parse.Query('Event').lessThan('startTime', new Date());
  const combined = Parse.Query.or(finishedQuery, startedQuery);
  combined.exists('address');
  return applyMuralLocationFilterToEventQuery(combined, filter);
}

async function loadMuralLocationEventIds(filter) {
  if (!filter || !filter.active) return null;
  const query = buildMuralLocationEventQuery(filter);
  query.select(['objectId']);
  query.limit(MURAL_LOCATION_EVENT_SCAN_LIMIT);
  const events = await query.find({ useMasterKey: true });
  return events.map((event) => event.id).filter(Boolean);
}

async function loadMuralVoteRowsForEventIds(eventIds) {
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return [];
  const rows = [];
  const seen = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const query = new Parse.Query('MuralVote');
    query.equalTo('scope', 'event');
    query.containedIn('scopeId', ids.slice(i, i + 200));
    query.include(['targetUser', 'voter']);
    query.limit(10000);
    for (const row of await query.find({ useMasterKey: true })) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}

Parse.Cloud.define('getMuralLocationOptions', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const level = String(request.params.level || 'state').trim();
  if (level !== 'state' && level !== 'city' && level !== 'neighborhood') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Nivel invalido. Use state, city ou neighborhood.'
    );
  }

  const state = normalizeBrazilUfLabel(request.params.state);
  const city = normalizeLocationLabel(request.params.city);
  if (level !== 'state' && !state) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o Estado.');
  }
  if (level === 'neighborhood' && !city) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a Cidade.');
  }

  const parentFilter = {
    state: level === 'state' ? '' : state,
    city: level === 'neighborhood' ? city : '',
    neighborhood: '',
    active: level !== 'state',
  };
  const query = buildCountedEventQueryForLocation(parentFilter);
  query.select(['address']);
  query.limit(MURAL_LOCATION_EVENT_SCAN_LIMIT);
  const events = await query.find({ useMasterKey: true });

  const counts = new Map();
  for (const event of events) {
    const address = event.get('address') || {};
    const eventState = normalizeBrazilUfLabel(address.state);
    const eventCity = normalizeLocationLabel(address.city);
    const eventNeighborhood = normalizeLocationLabel(address.neighborhood);

    let value = '';
    if (level === 'state') {
      value = eventState;
    } else if (level === 'city') {
      if (eventState !== state) continue;
      value = eventCity;
    } else {
      if (eventState !== state || eventCity !== city) continue;
      value = eventNeighborhood;
    }
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  const options = Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => {
      const diff = b.count - a.count;
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });

  return { options };
});

function sortLocationCounts(map) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
}

async function collectAppParticipantUserIdsForStats() {
  const ids = new Set();
  const userQuery = new Parse.Query(Parse.User);
  userQuery.exists('address');
  userQuery.limit(5000);
  const users = await userQuery.find({ useMasterKey: true });
  for (const user of users) {
    const address = user.get('address') || {};
    if (
      user.id &&
      (normalizeLocationLabel(address.state) ||
        normalizeLocationLabel(address.city) ||
        normalizeLocationLabel(address.neighborhood))
    ) {
      ids.add(user.id);
    }
  }
  return ids;
}

async function collectMuralStatsUserIds(scope, scopeId, extraUserIds) {
  const ids = new Set();
  for (const id of extraUserIds || []) {
    if (id) ids.add(String(id));
  }

  if (scope === 'app') {
    const appIds = await collectAppParticipantUserIdsForStats();
    for (const id of appIds) ids.add(id);
    return ids;
  }

  if (scope === 'pelada' && scopeId) {
    const participantIds = await collectPeladaParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  if (scope === 'event' && scopeId) {
    const participantIds = await collectEventParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  return ids;
}

function buildMuralParticipantLocationStats(users, includeState) {
  const byState = new Map();
  const byCity = new Map();
  const byNeighborhood = new Map();
  let total = 0;

  for (const user of users) {
    const address = user.get('address') || {};
    const state = normalizeBrazilUfLabel(address.state);
    const city = normalizeLocationLabel(address.city);
    const neighborhood = normalizeLocationLabel(address.neighborhood);

    if (!state && !city && !neighborhood) continue;
    total += 1;

    if (includeState && state) {
      byState.set(state, (byState.get(state) || 0) + 1);
    }

    if (city) {
      const cityLabel = includeState && state ? `${city} - ${state}` : city;
      byCity.set(cityLabel, (byCity.get(cityLabel) || 0) + 1);
    }

    if (neighborhood) {
      const neighborhoodLabel = [neighborhood, city, includeState ? state : '']
        .filter(Boolean)
        .join(' · ');
      byNeighborhood.set(neighborhoodLabel, (byNeighborhood.get(neighborhoodLabel) || 0) + 1);
    }
  }

  return {
    total,
    byState: includeState ? sortLocationCounts(byState) : [],
    byCity: sortLocationCounts(byCity),
    byNeighborhood: sortLocationCounts(byNeighborhood),
  };
}

Parse.Cloud.define('getMuralParticipantLocationStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const extraUserIds = Array.isArray(request.params.userIds) ? request.params.userIds : [];
  const includeState = scope === 'app';
  const userIds = await collectMuralStatsUserIds(scope, scopeId, extraUserIds);

  if (!userIds.size) {
    return {
      total: 0,
      byState: [],
      byCity: [],
      byNeighborhood: [],
    };
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  return buildMuralParticipantLocationStats(users, includeState);
});

async function buildHighlightGoalRowsFromRawPerformances(rawPerformances) {
  const conflictMap = await buildPeladaStatsConflictMapFromPerformances(rawPerformances);
  const goalsByEventUser = new Map();
  const eventIds = new Set();

  for (const perf of rawPerformances) {
    const userId = getPerformanceParticipantId(perf);
    if (!userId) continue;

    const role = perf.get('role') || 'athlete';
    if (role !== 'athlete') continue;

    const pelada = perf.get('pelada');
    const peladaId = pelada && pelada.id ? pelada.id : '';
    const priority = conflictMap.get(peladaId) || 'referee';
    const goals = resolveMuralHighlightGoals(perf, priority);
    if (goals <= 0) continue;

    const event = perf.get('event');
    const eventId = event && event.id ? String(event.id) : String(perf.id);
    if (event && event.id) eventIds.add(event.id);
    const eventUserKey = `${eventId}:${userId}`;
    const currentEventGoals = goalsByEventUser.get(eventUserKey) ?? 0;
    goalsByEventUser.set(eventUserKey, Math.max(currentEventGoals, goals));
  }

  const typeById = new Map();
  const idList = Array.from(eventIds);
  for (let i = 0; i < idList.length; i += 50) {
    const chunk = idList.slice(i, i + 50);
    const events = await new Parse.Query('Event')
      .containedIn('objectId', chunk)
      .select(['type'])
      .limit(chunk.length)
      .find({ useMasterKey: true });
    for (const event of events) {
      typeById.set(event.id, event.get('type') || '');
    }
  }

  const byUserId = new Map();
  for (const [eventUserKey, goals] of goalsByEventUser.entries()) {
    const parts = eventUserKey.split(':');
    const eventId = parts[0];
    const userId = parts.slice(1).join(':');
    if (!userId) continue;
    const type = typeById.get(eventId) || '';
    const bucket = type === 'team_match' ? 'teamMatch' : 'pelada';
    const current = byUserId.get(userId) || {
      userId,
      role: 'athlete',
      goals: 0,
      peladaGoals: 0,
      teamMatchGoals: 0,
      eventType: type || 'pelada',
    };
    current.goals += goals;
    if (bucket === 'teamMatch') current.teamMatchGoals += goals;
    else current.peladaGoals += goals;
    byUserId.set(userId, current);
  }

  return Array.from(byUserId.values());
}

function weightedGoleadorPointsFromRow(row, bucket) {
  const peladaGoals = Number(row.peladaGoals || 0);
  const teamMatchGoals = Number(row.teamMatchGoals || 0);
  if (bucket === 'pelada') return peladaGoals;
  if (bucket === 'team_match') return teamMatchGoals;
  return peladaGoals + teamMatchGoals * TEAM_MATCH_MURAL_WEIGHT;
}

async function buildAppTopScorerRankingEntries(rawPerformances, bucket, topN = 10) {
  const rows = await buildHighlightGoalRowsFromRawPerformances(rawPerformances);
  const scored = rows
    .map((row) => {
      const peladaGoals = Number(row.peladaGoals || 0);
      const teamMatchGoals = Number(row.teamMatchGoals || 0);
      const displayGoals = peladaGoals + teamMatchGoals;
      return {
        userId: row.userId,
        userName: 'Participante',
        role: 'athlete',
        weightedGoals: weightedGoleadorPointsFromRow(row, bucket),
        displayGoals,
        peladaGoals,
        teamMatchGoals,
      };
    })
    .filter((row) => row.weightedGoals > 0);

  const ageByUserId = await loadUserAgesForRanking(scored.map((row) => row.userId));
  scored.sort((a, b) => {
    const diff = b.weightedGoals - a.weightedGoals;
    if (diff !== 0) return diff;
    return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
  });

  const topRows = scored.slice(0, topN);
  const enriched = await enrichMuralRankingNames('app', undefined, { athlete: topRows });
  return (enriched.athlete || []).map((entry, index) => {
    const row = topRows[index];
    const displayGoals = row?.displayGoals ?? 0;
    return {
      ...entry,
      weightedGoals: row?.weightedGoals ?? 0,
      // Cards mostram gols reais; peso 3x fica so no sort (weightedGoals).
      totalScore: displayGoals,
      combinedScore: displayGoals,
    };
  });
}

/** Aplica campos de exibicao (sem peso 3x) mantendo a ordem ja calculada com peso. */
function applyMergedRankingDisplayFields(orderedRankings, displayRankings) {
  const result = { ...orderedRankings };
  for (const role of MURAL_TARGET_ROLES) {
    const ordered = orderedRankings[role] || [];
    const displayById = new Map((displayRankings[role] || []).map((entry) => [entry.userId, entry]));
    result[role] = ordered.map((entry) => {
      const display = displayById.get(entry.userId);
      if (!display) {
        return {
          ...entry,
          rankingScore: Number(entry.combinedScore || entry.totalScore || 0),
        };
      }
      return {
        ...entry,
        rankingScore: Number(entry.combinedScore || entry.totalScore || 0),
        totalScore: Number(display.totalScore || 0),
        performanceScore: Number(display.performanceScore || 0),
        combinedScore: Number(display.combinedScore || 0),
        averageScore: Number(display.averageScore || 0),
        voteCount: Number(display.voteCount || 0),
      };
    });
  }
  return result;
}

function unweightPerformanceRowsForDisplay(performanceRows) {
  return performanceRows.map((row) => ({
    ...row,
    score:
      row.eventType === 'team_match'
        ? Number(row.score || 0) / TEAM_MATCH_MURAL_WEIGHT
        : Number(row.score || 0),
  }));
}

/**
 * Ranking de peladas do Mural do App.
 * Teto: MURAL_LOCATION_EVENT_SCAN_LIMIT (5000) eventos realizados, depois de unir
 * a consulta com tipo diferente de team_match e a de tipo ausente (cada uma limitada a 5000).
 * Demais lotes: MuralVote 10000/200 scopeId; EventPerformance 3000/50 eventos;
 * EventRegistration 2000/50; FanPrediction 1000/50; EventMediaPublication 500/50;
 * RefereeInvitation 500/50; caixa, cotinha, socios e AppMessage 1000 por lote de ids candidatos.
 */
const PELADA_RANK_EVENT_LIMIT = MURAL_LOCATION_EVENT_SCAN_LIMIT;
const PELADA_RANK_PROFILE_ROLES = {
  athlete: 'athlete',
  goalkeeper: 'athlete',
  referee: 'referee',
  scout: 'scout',
  journalist: 'journalist',
  narrator: 'narrator',
  cameraman: 'cameraman',
  coach: 'coach',
  physical_trainer: 'physical_trainer',
  masseur: 'masseur',
  kitman: 'kitman',
  gandula: 'gandula',
  gatekeeper: 'gatekeeper',
  fan: 'fan',
};

function peladaRankChunks(items, size) {
  const chunks = [];
  const list = items || [];
  const step = Math.max(1, size);
  for (let i = 0; i < list.length; i += step) {
    chunks.push(list.slice(i, i + step));
  }
  return chunks;
}

function peladaRankPointerId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.id ? String(value.id) : '';
}

function peladaRankRound(total, count) {
  if (!count) return 0;
  return Math.round((Number(total) / count) * 100) / 100;
}

function peladaRankProfileRole(role) {
  return PELADA_RANK_PROFILE_ROLES[String(role || '').trim()] || '';
}

function peladaRankEventEndPassed(event, now) {
  const endTime = event.get('endTime');
  if (!endTime) return false;
  const time = endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime();
  return !Number.isNaN(time) && time < now.getTime();
}

function peladaRankImageUrl(pelada) {
  const file = pelada && pelada.get ? pelada.get('locationPhoto') : null;
  if (!file || typeof file.url !== 'function') return '';
  try {
    return String(file.url() || '').trim();
  } catch (error) {
    return '';
  }
}

function peladaRankPlace(pelada) {
  const address = (pelada && pelada.get && pelada.get('address')) || {};
  const state = normalizeLocationLabel(address.state);
  const city = normalizeLocationLabel(address.city);
  const neighborhood = normalizeLocationLabel(address.neighborhood);
  return [state, city, neighborhood].filter(Boolean).join(' · ');
}

function peladaRankAdminFields(pelada) {
  const admin = pelada && pelada.get ? pelada.get('admin') : null;
  if (!admin || !admin.id) return {};
  const apelido = (admin.get('apelido') || '').trim();
  const fullName = (admin.get('name') || '').trim();
  const adminName = apelido || fullName || admin.getUsername() || '';
  const fields = { adminId: admin.id, adminName };
  const avatarUrl = admin.get('avatarUrl');
  if (avatarUrl) fields.adminAvatarUrl = String(avatarUrl);
  return fields;
}

function peladaRankCreatedAtIso(pelada) {
  const createdAt = pelada && pelada.get ? pelada.get('createdAt') : null;
  if (!createdAt) return '';
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function peladaRankFavoriteName(value) {
  const name = normalizeLocationLabel(value);
  if (!name || name.toLowerCase() === 'sem time') return '';
  return name;
}

function peladaRankUserHasBirthDate(user) {
  const birth = user && user.get ? user.get('birthDate') : null;
  if (!birth) return false;
  if (birth instanceof Date) return !Number.isNaN(birth.getTime());
  return String(birth).trim().length > 0;
}

function emptyPeladaRankEventStats() {
  return {
    athleteVote: false,
    goalkeeperVote: false,
    refereeVote: false,
    goals: false,
    goalkeeperStats: false,
    refereeSumula: false,
    prediction: false,
    media: false,
    birthDate: false,
    favoriteTeam: false,
    profiles: new Set(),
    participantIds: new Set(),
    voterIds: new Set(),
    voteCount: 0,
    redCards: 0,
    yellowCards: 0,
  };
}

function performanceHasRecordedGoals(perf) {
  if (Number(perf.get('goals') || 0) > 0) return true;
  if (Number(perf.get('scoutGoals') || 0) > 0) return true;
  if (Number(perf.get('refereeGoals') || 0) > 0) return true;
  const typed = [
    'goalsHeader',
    'goalsFreeKick',
    'goalsRightFoot',
    'goalsLeftFoot',
    'goalsOlympic',
    'goalsCrazy',
    'goalsPenalty',
  ];
  for (const field of typed) {
    if (Number(perf.get(field) || 0) > 0) return true;
  }
  return false;
}

function performanceHasGoalkeeperFill(perf) {
  return (
    Number(perf.get('saves') || 0) > 0 ||
    Number(perf.get('goalsConceded') || 0) > 0 ||
    Number(perf.get('refereeGoalsConceded') || 0) > 0
  );
}

function performanceHasRefereeSumulaNumbers(perf) {
  const sumulaFields = [
    'refereeGoals',
    'refereeYellowCards',
    'refereeRedCards',
    'refereeFoulsCommitted',
  ];
  for (const field of sumulaFields) {
    if (Number(perf.get(field) || 0) > 0) return true;
  }
  if (String(perf.get('role') || '') !== 'referee') return false;
  return (
    Number(perf.get('goals') || 0) > 0 ||
    Number(perf.get('yellowCards') || 0) > 0 ||
    Number(perf.get('redCards') || 0) > 0 ||
    Number(perf.get('fouls') || 0) > 0 ||
    Number(perf.get('foulsCommitted') || 0) > 0
  );
}

function mediaPublicationIsPublished(row) {
  return !!(
    String(row.get('highlightVideoUrl') || '').trim() ||
    String(row.get('radioNarrationTitle') || '').trim() ||
    String(row.get('radioInterviewTitle') || '').trim() ||
    String(row.get('journalReportageHeadline') || '').trim() ||
    String(row.get('journalInterviewHeadline') || '').trim()
  );
}

async function loadHeldPeladaEventsForRanking(filter) {
  const now = new Date();
  async function load(applyType) {
    const finishedQuery = new Parse.Query('Event').equalTo('isFinished', true);
    const endedQuery = new Parse.Query('Event').lessThan('endTime', now);
    applyType(finishedQuery);
    applyType(endedQuery);
    const combined = Parse.Query.or(finishedQuery, endedQuery);
    if (filter && filter.active) {
      combined.exists('address');
      applyMuralLocationFilterToEventQuery(combined, filter);
    }
    combined.include('pelada');
    combined.limit(PELADA_RANK_EVENT_LIMIT);
    return combined.find({ useMasterKey: true });
  }

  const [typed, untyped] = await Promise.all([
    load((query) => query.notEqualTo('type', 'team_match')),
    load((query) => query.doesNotExist('type')),
  ]);

  const byId = new Map();
  for (const event of typed.concat(untyped)) {
    if (!event || !event.id || byId.has(event.id)) continue;
    if (event.get('type') === 'team_match') continue;
    const pelada = event.get('pelada');
    if (!pelada || !pelada.id) continue;
    const finished = event.get('isFinished') === true;
    if (!finished && !peladaRankEventEndPassed(event, now)) continue;
    byId.set(event.id, event);
  }

  const events = Array.from(byId.values());
  events.sort((a, b) => {
    const aEnd = a.get('endTime') instanceof Date ? a.get('endTime').getTime() : 0;
    const bEnd = b.get('endTime') instanceof Date ? b.get('endTime').getTime() : 0;
    return bEnd - aEnd;
  });
  return events.slice(0, PELADA_RANK_EVENT_LIMIT);
}

async function loadPeladasByIdsForRanking(ids) {
  const byId = new Map();
  for (const chunk of peladaRankChunks(ids, 100)) {
    const query = new Parse.Query('Pelada');
    query.containedIn('objectId', chunk);
    query.select(['name', 'address', 'locationPhoto', 'createdAt', 'admin']);
    query.include('admin');
    query.limit(chunk.length);
    const rows = await query.find({ useMasterKey: true });
    for (const row of rows) {
      if (row.id) byId.set(row.id, row);
    }
  }
  return byId;
}

async function loadPeladaRankUserSignals(userIds) {
  const birth = new Set();
  const teams = new Set();
  const missingTeamUsers = [];
  for (const chunk of peladaRankChunks(userIds, 100)) {
    const query = new Parse.Query(Parse.User);
    query.containedIn('objectId', chunk);
    query.select(['birthDate', 'favoriteProTeam']);
    query.limit(chunk.length);
    const users = await query.find({ useMasterKey: true });
    for (const user of users) {
      if (!user.id) continue;
      if (peladaRankUserHasBirthDate(user)) birth.add(user.id);
      const direct =
        typeof readUserFavoriteProTeam === 'function'
          ? readUserFavoriteProTeam(user)
          : user.get('favoriteProTeam');
      if (peladaRankFavoriteName(direct)) teams.add(user.id);
      else missingTeamUsers.push(user);
    }
  }

  for (const chunk of peladaRankChunks(missingTeamUsers, 100)) {
    const athleteQuery = new Parse.Query('AthleteProfile');
    athleteQuery.containedIn('user', chunk);
    athleteQuery.select(['user', 'favoriteProTeam']);
    athleteQuery.limit(chunk.length);
    const fanQuery = new Parse.Query('FanProfile');
    fanQuery.containedIn('user', chunk);
    fanQuery.select(['user', 'favoriteProTeam']);
    fanQuery.limit(chunk.length);
    const [athletes, fans] = await Promise.all([
      athleteQuery.find({ useMasterKey: true }),
      fanQuery.find({ useMasterKey: true }),
    ]);
    const legacy = new Map();
    for (const row of athletes.concat(fans)) {
      const userId = peladaRankPointerId(row.get('user'));
      const team = peladaRankFavoriteName(row.get('favoriteProTeam'));
      if (!userId || !team || legacy.has(userId)) continue;
      legacy.set(userId, team);
    }
    for (const userId of legacy.keys()) teams.add(userId);
  }

  return { birth, teams };
}

async function pointerIdsPresent(className, field, objects, perChunkLimit, constrain) {
  const found = new Set();
  for (const chunk of peladaRankChunks(objects, 50)) {
    const pending = chunk.filter((obj) => obj && obj.id && !found.has(obj.id));
    if (!pending.length) continue;
    const query = new Parse.Query(className);
    query.containedIn(field, pending);
    query.select([field]);
    query.limit(perChunkLimit);
    if (constrain) constrain(query);
    const rows = await query.find({ useMasterKey: true });
    for (const row of rows) {
      const id = peladaRankPointerId(row.get(field));
      if (id) found.add(id);
    }
    if (rows.length < perChunkLimit) continue;
    for (const obj of pending) {
      if (!obj.id || found.has(obj.id)) continue;
      const one = new Parse.Query(className);
      one.equalTo(field, obj);
      one.select([field]);
      one.limit(1);
      if (constrain) constrain(one);
      const hit = await one.first({ useMasterKey: true });
      if (hit) found.add(obj.id);
    }
  }
  return found;
}

async function loadConfirmedCotinhaPeladaIds(peladas) {
  const cotinhaToPelada = new Map();
  const cotinhas = [];
  for (const chunk of peladaRankChunks(peladas, 50)) {
    const query = new Parse.Query('PeladaCotinha');
    query.containedIn('pelada', chunk);
    query.select(['pelada']);
    query.limit(1000);
    const rows = await query.find({ useMasterKey: true });
    for (const row of rows) {
      const peladaId = peladaRankPointerId(row.get('pelada'));
      if (!row.id || !peladaId) continue;
      cotinhaToPelada.set(row.id, peladaId);
      cotinhas.push(row);
    }
  }

  const confirmed = new Set();
  for (const chunk of peladaRankChunks(cotinhas, 50)) {
    const query = new Parse.Query('PeladaCotinhaPayment');
    query.containedIn('cotinha', chunk);
    query.equalTo('confirmedByAdmin', true);
    query.select(['cotinha']);
    query.limit(1000);
    const rows = await query.find({ useMasterKey: true });
    for (const row of rows) {
      const peladaId = cotinhaToPelada.get(peladaRankPointerId(row.get('cotinha')));
      if (peladaId) confirmed.add(peladaId);
    }
  }
  return confirmed;
}

async function loadMembershipIdsByPelada(peladas) {
  const membershipToPelada = new Map();
  for (const chunk of peladaRankChunks(peladas, 20)) {
    const query = new Parse.Query('PeladaMembership');
    query.containedIn('pelada', chunk);
    query.select(['pelada']);
    query.limit(1000);
    const rows = await query.find({ useMasterKey: true });
    for (const row of rows) {
      const peladaId = peladaRankPointerId(row.get('pelada'));
      if (row.id && peladaId) membershipToPelada.set(row.id, peladaId);
    }
  }
  return membershipToPelada;
}

async function loadMailboxPeladaIds(peladaIds, eventsByPelada, membershipToPelada) {
  const relatedToPelada = new Map();
  for (const peladaId of peladaIds) relatedToPelada.set(peladaId, peladaId);
  for (const [peladaId, events] of eventsByPelada.entries()) {
    for (const event of events) {
      if (event.id) relatedToPelada.set(event.id, peladaId);
    }
  }
  for (const [membershipId, peladaId] of membershipToPelada.entries()) {
    relatedToPelada.set(membershipId, peladaId);
  }

  const hit = new Set();
  const ids = Array.from(relatedToPelada.keys());
  for (const chunk of peladaRankChunks(ids, 100)) {
    const unseen = chunk.filter((id) => {
      const peladaId = relatedToPelada.get(id);
      return peladaId && !hit.has(peladaId);
    });
    if (!unseen.length) continue;
    const query = new Parse.Query('AppMessage');
    query.containedIn('relatedId', unseen);
    query.select(['relatedId']);
    query.limit(1000);
    const rows = await query.find({ useMasterKey: true });
    for (const row of rows) {
      const peladaId = relatedToPelada.get(String(row.get('relatedId') || ''));
      if (peladaId) hit.add(peladaId);
    }
    if (rows.length < 1000) continue;
    for (const id of unseen) {
      const peladaId = relatedToPelada.get(id);
      if (!peladaId || hit.has(peladaId)) continue;
      const one = new Parse.Query('AppMessage');
      one.equalTo('relatedId', id);
      one.select(['relatedId']);
      one.limit(1);
      const row = await one.first({ useMasterKey: true });
      if (row) hit.add(peladaId);
    }
  }
  return hit;
}

function comparePeladaRank(a, b) {
  if (b.eventsHeld !== a.eventsHeld) return b.eventsHeld - a.eventsHeld;
  if (b.filledCardsAverage !== a.filledCardsAverage) {
    return b.filledCardsAverage - a.filledCardsAverage;
  }
  if (b.distinctProfilesAverage !== a.distinctProfilesAverage) {
    return b.distinctProfilesAverage - a.distinctProfilesAverage;
  }
  if (b.participantsAverage !== a.participantsAverage) {
    return b.participantsAverage - a.participantsAverage;
  }
  if (b.distinctVotersAverage !== a.distinctVotersAverage) {
    return b.distinctVotersAverage - a.distinctVotersAverage;
  }
  if (b.votesAverage !== a.votesAverage) return b.votesAverage - a.votesAverage;
  if (a.redCardsAverage !== b.redCardsAverage) return a.redCardsAverage - b.redCardsAverage;
  if (a.yellowCardsAverage !== b.yellowCardsAverage) {
    return a.yellowCardsAverage - b.yellowCardsAverage;
  }
  const cashDiff = (b.hasCash ? 1 : 0) - (a.hasCash ? 1 : 0);
  if (cashDiff !== 0) return cashDiff;
  const cotinhaDiff = (b.hasCotinha ? 1 : 0) - (a.hasCotinha ? 1 : 0);
  if (cotinhaDiff !== 0) return cotinhaDiff;
  const mailDiff = (b.hasMailbox ? 1 : 0) - (a.hasMailbox ? 1 : 0);
  if (mailDiff !== 0) return mailDiff;
  const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aCreated !== bCreated) return aCreated - bCreated;
  const nameDiff = String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
  if (nameDiff !== 0) return nameDiff;
  return String(a.peladaId).localeCompare(String(b.peladaId));
}

async function buildAppPeladaRanking(locationFilter) {
  const empty = { bestPelada: null, topPeladas: [] };
  try {
    const events = await loadHeldPeladaEventsForRanking(locationFilter);
    if (!events.length) return empty;

    const eventById = new Map();
    const eventsByPelada = new Map();
    for (const event of events) {
      const peladaId = peladaRankPointerId(event.get('pelada'));
      if (!peladaId) continue;
      eventById.set(event.id, event);
      if (!eventsByPelada.has(peladaId)) eventsByPelada.set(peladaId, []);
      eventsByPelada.get(peladaId).push(event);
    }
    if (!eventById.size) return empty;

    const peladaById = await loadPeladasByIdsForRanking(Array.from(eventsByPelada.keys()));
    const peladaObjects = Array.from(peladaById.values());
    const eventList = Array.from(eventById.values());
    const statsByEvent = new Map();
    const ensureStats = (eventId) => {
      if (!statsByEvent.has(eventId)) {
        statsByEvent.set(eventId, emptyPeladaRankEventStats());
      }
      return statsByEvent.get(eventId);
    };

    const collectVotes = async () => {
      const eventIds = Array.from(eventById.keys());
      for (const chunk of peladaRankChunks(eventIds, 200)) {
        const query = new Parse.Query('MuralVote');
        query.equalTo('scope', 'event');
        query.containedIn('scopeId', chunk);
        query.select(['scopeId', 'targetRole', 'voter']);
        query.limit(10000);
        const rows = await query.find({ useMasterKey: true });
        for (const row of rows) {
          const eventId = String(row.get('scopeId') || '');
          if (!eventById.has(eventId)) continue;
          const stats = ensureStats(eventId);
          stats.voteCount += 1;
          const voterId = peladaRankPointerId(row.get('voter'));
          if (voterId) stats.voterIds.add(voterId);
          const role = String(row.get('targetRole') || '');
          if (role === 'athlete') stats.athleteVote = true;
          if (role === 'goalkeeper') stats.goalkeeperVote = true;
          if (role === 'referee') stats.refereeVote = true;
        }
      }
    };

    const collectPerformances = async () => {
      for (const chunk of peladaRankChunks(eventList, 50)) {
        const query = new Parse.Query('EventPerformance');
        query.containedIn('event', chunk);
        query.limit(3000);
        const rows = await query.find({ useMasterKey: true });
        for (const row of rows) {
          const eventId = peladaRankPointerId(row.get('event'));
          if (!eventById.has(eventId)) continue;
          const stats = ensureStats(eventId);
          if (performanceHasRecordedGoals(row)) stats.goals = true;
          if (performanceHasGoalkeeperFill(row)) stats.goalkeeperStats = true;
          if (performanceHasRefereeSumulaNumbers(row)) stats.refereeSumula = true;
          stats.yellowCards += Number(row.get('yellowCards') || 0);
          stats.redCards += Number(row.get('redCards') || 0);
        }
      }
    };

    const participantIds = new Set();
    const collectRegistrations = async () => {
      for (const chunk of peladaRankChunks(eventList, 50)) {
        const query = new Parse.Query('EventRegistration');
        query.containedIn('event', chunk);
        query.limit(2000);
        const rows = await query.find({ useMasterKey: true });
        for (const row of rows) {
          const eventId = peladaRankPointerId(row.get('event'));
          const event = eventById.get(eventId);
          if (!event) continue;
          const fee = Number(event.get('participationFee') || 0);
          const confirmed =
            typeof computeRegistrationEffectiveConfirmation === 'function'
              ? !!computeRegistrationEffectiveConfirmation(row, fee)
              : row.get('isEffectivelyConfirmed') === true;
          if (!confirmed) continue;
          const stats = ensureStats(eventId);
          const profile = peladaRankProfileRole(row.get('role') || 'athlete');
          if (profile) stats.profiles.add(profile);
          const userId = String(
            row.get('participantUserId') || peladaRankPointerId(row.get('user')) || ''
          );
          if (!userId) continue;
          stats.participantIds.add(userId);
          participantIds.add(userId);
        }
      }
    };

    const collectInvitations = async () => {
      for (const chunk of peladaRankChunks(eventList, 50)) {
        const query = new Parse.Query('RefereeInvitation');
        query.containedIn('event', chunk);
        query.equalTo('status', 'accepted');
        query.select(['event', 'role']);
        query.limit(500);
        const rows = await query.find({ useMasterKey: true });
        for (const row of rows) {
          const eventId = peladaRankPointerId(row.get('event'));
          if (!eventById.has(eventId)) continue;
          const profile = peladaRankProfileRole(row.get('role'));
          if (!profile) continue;
          ensureStats(eventId).profiles.add(profile);
        }
      }
    };

    const collectPredictions = async () => {
      for (const chunk of peladaRankChunks(eventList, 50)) {
        const query = new Parse.Query('FanPrediction');
        query.containedIn('event', chunk);
        query.select(['event']);
        query.limit(1000);
        const rows = await query.find({ useMasterKey: true });
        for (const row of rows) {
          const eventId = peladaRankPointerId(row.get('event'));
          if (eventById.has(eventId)) ensureStats(eventId).prediction = true;
        }
      }
    };

    const collectMedia = async () => {
      for (const chunk of peladaRankChunks(eventList, 50)) {
        const query = new Parse.Query('EventMediaPublication');
        query.containedIn('event', chunk);
        query.limit(500);
        const rows = await query.find({ useMasterKey: true });
        for (const row of rows) {
          if (!mediaPublicationIsPublished(row)) continue;
          const eventId =
            peladaRankPointerId(row.get('event')) || String(row.get('eventId') || '');
          if (eventById.has(eventId)) ensureStats(eventId).media = true;
        }
      }
    };

    await Promise.all([
      collectVotes(),
      collectPerformances(),
      collectRegistrations(),
      collectInvitations(),
      collectPredictions(),
      collectMedia(),
    ]);

    const signals = await loadPeladaRankUserSignals(Array.from(participantIds));
    for (const stats of statsByEvent.values()) {
      for (const userId of stats.participantIds) {
        if (signals.birth.has(userId)) stats.birthDate = true;
        if (signals.teams.has(userId)) stats.favoriteTeam = true;
        if (stats.birthDate && stats.favoriteTeam) break;
      }
    }

    let cashIds = new Set();
    let cotinhaIds = new Set();
    let mailboxIds = new Set();
    try {
      cashIds = await pointerIdsPresent('PeladaCashEntry', 'pelada', peladaObjects, 1000);
    } catch (error) {
      console.error('pelada rank cash failed', error);
    }
    try {
      cotinhaIds = await loadConfirmedCotinhaPeladaIds(peladaObjects);
    } catch (error) {
      console.error('pelada rank cotinha failed', error);
    }
    try {
      const membershipToPelada = await loadMembershipIdsByPelada(peladaObjects);
      mailboxIds = await loadMailboxPeladaIds(
        Array.from(eventsByPelada.keys()),
        eventsByPelada,
        membershipToPelada
      );
    } catch (error) {
      console.error('pelada rank mailbox failed', error);
    }

    const ranked = [];
    for (const [peladaId, peladaEvents] of eventsByPelada.entries()) {
      const count = peladaEvents.length;
      if (!count) continue;
      let filled = 0;
      let profiles = 0;
      let participants = 0;
      let voters = 0;
      let votes = 0;
      let red = 0;
      let yellow = 0;
      for (const event of peladaEvents) {
        const stats = statsByEvent.get(event.id) || emptyPeladaRankEventStats();
        let cards = 0;
        if (stats.athleteVote) cards += 1;
        if (stats.goals) cards += 1;
        if (stats.goalkeeperVote || stats.goalkeeperStats) cards += 1;
        if (stats.refereeVote || stats.refereeSumula) cards += 1;
        if (stats.prediction) cards += 1;
        if (stats.media) cards += 1;
        if (stats.birthDate) cards += 1;
        if (stats.favoriteTeam) cards += 1;
        filled += cards;
        profiles += stats.profiles.size;
        participants += stats.participantIds.size;
        voters += stats.voterIds.size;
        votes += stats.voteCount;
        red += stats.redCards;
        yellow += stats.yellowCards;
      }
      const pelada = peladaById.get(peladaId) || peladaEvents[0].get('pelada');
      const imageUrl = peladaRankImageUrl(pelada);
      const entry = {
        peladaId,
        name: (pelada && pelada.get && pelada.get('name')) || 'Pelada',
        place: peladaRankPlace(pelada),
        ...peladaRankAdminFields(pelada),
        eventsHeld: count,
        filledCardsAverage: peladaRankRound(filled, count),
        distinctProfilesAverage: peladaRankRound(profiles, count),
        participantsAverage: peladaRankRound(participants, count),
        distinctVotersAverage: peladaRankRound(voters, count),
        votesAverage: peladaRankRound(votes, count),
        redCardsAverage: peladaRankRound(red, count),
        yellowCardsAverage: peladaRankRound(yellow, count),
        hasCash: cashIds.has(peladaId),
        hasCotinha: cotinhaIds.has(peladaId),
        hasMailbox: mailboxIds.has(peladaId),
      };
      const createdAt = peladaRankCreatedAtIso(pelada);
      if (createdAt) entry.createdAt = createdAt;
      if (imageUrl) entry.imageUrl = imageUrl;
      ranked.push(entry);
    }

    ranked.sort(comparePeladaRank);
    const topPeladas = ranked.slice(0, 10);
    return {
      bestPelada: topPeladas.length ? topPeladas[0] : null,
      topPeladas,
    };
  } catch (error) {
    console.error('buildAppPeladaRanking failed', error);
    return empty;
  }
}

async function buildAppMuralBucketPayload(
  scope,
  performanceRows,
  voteRows,
  performanceRaw,
  bucket,
  locationFilter
) {
  let perf = performanceRows;
  let votes = voteRows;
  if (bucket === 'pelada') {
    votes = unweightVoteRows(filterVoteRowsByEventBucket(voteRows, 'pelada'));
    perf = filterPerformanceRowsByEventBucket(performanceRows, 'pelada');
  } else if (bucket === 'team_match') {
    votes = unweightVoteRows(filterVoteRowsByEventBucket(voteRows, 'teamMatch'));
    perf = normalizePerformanceScoresForBucket(
      filterPerformanceRowsByEventBucket(performanceRows, 'teamMatch'),
      'teamMatch'
    );
  }

  let rankings = buildPeladaMuralRankings(perf, votes, 10);
  rankings = await enrichMuralRankingNames(scope, undefined, rankings);
  rankings = await finalizeEventGoalkeeperRankings(rankings);
  rankings = await finalizeMuralRankingsAgeTiebreak(rankings);
  rankings = applyAppMuralRankingConfidence(rankings, votes, 10);

  let voteAggregates = buildMuralVoteAggregatesFromRows(votes);

  if (bucket === 'merged') {
    const displayVotes = unweightVoteRows(voteRows);
    const displayPerf = unweightPerformanceRowsForDisplay(performanceRows);
    const displayRankings = buildPeladaMuralRankings(displayPerf, displayVotes, 50);
    rankings = applyMergedRankingDisplayFields(rankings, displayRankings);
    voteAggregates = buildMuralVoteAggregatesFromRows(displayVotes, voteRows);
  }

  const topScorers = await buildAppTopScorerRankingEntries(performanceRaw, bucket, 10);
  const predictionRankings = await computePredictionRankingEntries(scope, undefined, 10, bucket);

  let topTeams = [];
  let topCoaches = [];
  // Recorte de regiao: o dashboard de confrontos (spotlight.teamRows) preenche esses tops.
  // Sem filtro, a varredura nacional (ate 300 times) permanece.
  if ((bucket === 'merged' || bucket === 'team_match') && !(locationFilter && locationFilter.active)) {
    if (typeof buildTopTeamsByMatchPoints === 'function') {
      topTeams = await buildTopTeamsByMatchPoints(10);
    }
    if (typeof buildTopCoachesByMatchPoints === 'function') {
      topCoaches = await buildTopCoachesByMatchPoints(10);
    }
  }

  return {
    bucket,
    rankings,
    voteAggregates,
    topScorers,
    topTeams,
    topCoaches,
    predictionRankings,
  };
}

// Highlights, dashboards e votacao do evento
Parse.Cloud.define('getMuralHighlightPerformances', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const rawPerformances = await loadMuralPerformanceRows(scope, scopeId);
  return buildHighlightGoalRowsFromRawPerformances(rawPerformances);
});

function filterVoteRowsByEventBucket(voteRows, bucket) {
  if (bucket === 'teamMatch') {
    return voteRows.filter((vote) => Number(vote.scoreWeight || 1) === TEAM_MATCH_MURAL_WEIGHT);
  }
  return voteRows.filter((vote) => Number(vote.scoreWeight || 1) !== TEAM_MATCH_MURAL_WEIGHT);
}

function unweightVoteRows(voteRows) {
  return voteRows.map((vote) => ({
    ...vote,
    scoreWeight: 1,
    weightedScore: Number(vote.score || 0),
  }));
}

function filterPerformanceRowsByEventBucket(performanceRows, bucket) {
  if (bucket === 'teamMatch') {
    return performanceRows.filter((row) => row.eventType === 'team_match');
  }
  return performanceRows.filter((row) => row.eventType !== 'team_match');
}

function normalizePerformanceScoresForBucket(performanceRows, bucket) {
  if (bucket !== 'teamMatch') return performanceRows;
  return performanceRows.map((row) => ({
    ...row,
    score: Number(row.score || 0) / TEAM_MATCH_MURAL_WEIGHT,
  }));
}

function buildMuralVoteAggregatesFromRows(voteRows, rankingVoteRows) {
  const result = {};
  for (const role of MURAL_TARGET_ROLES) {
    result[role] = {};
  }
  const displayRows = dedupeMuralVoteRowsByVoter(voteRows);
  for (const vote of displayRows) {
    if (!vote.targetUserId) continue;
    const role = vote.targetRole;
    if (!result[role]) continue;
    const current = result[role][vote.targetUserId] || {
      totalScore: 0,
      rankingScore: 0,
      voteCount: 0,
      userName: vote.targetUserName || 'Participante',
    };
    current.totalScore += Number(vote.score || 0);
    current.voteCount += 1;
    if (vote.targetUserName && vote.targetUserName !== 'Participante') {
      current.userName = vote.targetUserName;
    }
    result[role][vote.targetUserId] = current;
  }

  const rankSource = rankingVoteRows || voteRows;
  for (const vote of dedupeMuralVoteRowsByVoter(rankSource)) {
    if (!vote.targetUserId) continue;
    const role = vote.targetRole;
    if (!result[role] || !result[role][vote.targetUserId]) continue;
    const weight = Number(vote.scoreWeight || 1) || 1;
    const weighted = Number(
      vote.weightedScore != null ? vote.weightedScore : vote.score * weight
    );
    result[role][vote.targetUserId].rankingScore += weighted;
  }

  // Sem rankingVoteRows separado: rankingScore espelha totalScore (ja raw ou ja ponderado no input).
  if (!rankingVoteRows) {
    for (const role of MURAL_TARGET_ROLES) {
      for (const userId of Object.keys(result[role])) {
        const row = result[role][userId];
        if (!row.rankingScore) row.rankingScore = row.totalScore;
      }
    }
  }

  return result;
}

Parse.Cloud.define('getMuralVoteAggregates', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const voteRows = await mapMuralVoteRowsForScope(scope, scopeId);
  // Quorum e informativo no cliente (nota de integridade); nao esconde agregados.
  return buildMuralVoteAggregatesFromRows(voteRows);
});

Parse.Cloud.define('getMuralRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const limit = Math.min(Number(request.params.limit) || 10, 10000);

  if (scope === 'event' && scopeId) {
    const voteRows = await mapMuralVoteRowsForScope(scope, scopeId);
    // Quorum e informativo no cliente; rankings continuam visiveis.
    const rankings = await finalizeEventGoalkeeperRankings(
      await enrichMuralRankingNames(scope, scopeId, buildEventVoteRankings(voteRows, limit))
    );
    return rankings;
  }

  const performanceRows = await mapPerformanceRowsForMural(scope, scopeId, await loadMuralPerformanceRows(scope, scopeId));
  const voteRows = await mapMuralVoteRowsForScope(scope, scopeId);
  let rankings =
    scope === 'app' || (scope === 'pelada' && scopeId)
      ? buildPeladaMuralRankings(performanceRows, voteRows, limit)
      : buildMuralRankingsFromData(performanceRows, voteRows, limit);
  rankings = await finalizeEventGoalkeeperRankings(
    await enrichMuralRankingNames(scope, scopeId, rankings)
  );
  return rankings;
});

Parse.Cloud.define('getMuralLocationTopRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  if (scope !== 'app') {
    return {
      byState: [],
      byCity: [],
      byNeighborhood: [],
    };
  }

  const performanceRows = await mapPerformanceRowsForMural('app', undefined, await loadMuralPerformanceRows('app'));
  const voteRows = await mapMuralVoteRowsForScope('app');
  let fullRankings = buildPeladaMuralRankings(performanceRows, voteRows, 10000);
  fullRankings = await enrichMuralRankingNames('app', undefined, fullRankings);

  const userIds = await collectAppParticipantUserIdsForStats();
  if (!userIds.size) {
    return {
      byState: [],
      byCity: [],
      byNeighborhood: [],
    };
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  return buildMuralLocationTopRankingsFromUsers(users, fullRankings, true);
});

async function loadRecentAppParticipantRows(limit, locationFilter) {
  const cap = Math.min(Number(limit) || 500, 500);
  const registrationQuery = new Parse.Query('EventRegistration')
    .descending('createdAt')
    .include('user')
    .limit(cap);
  if (locationFilter && locationFilter.active) {
    registrationQuery.matchesQuery('event', buildMuralLocationEventQuery(locationFilter));
  }
  const registrations = await registrationQuery.find({ useMasterKey: true });

  const byUser = {};
  for (const registration of registrations) {
    const userId = getRegistrationUserId(registration);
    if (!userId) continue;

    const role = registration.get('role') || 'athlete';
    const user = registration.get('user');
    const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
    const userName =
      apelido ||
      (registration.get('userDisplayName') || '').trim() ||
      (registration.get('userFullName') || '').trim() ||
      (user && user.get ? (user.get('apelido') || '').trim() : '') ||
      (user && user.get ? (user.get('name') || '').trim() : '') ||
      'Participante';
    const avatarUrl = resolveStoredAvatarUrl(user, registration);

    if (!byUser[userId]) {
      byUser[userId] = {
        userId,
        userName,
        apelido,
        fullName:
          (registration.get('userFullName') || '').trim() ||
          (user && user.get ? (user.get('name') || '').trim() : '') ||
          '',
        roles: [role],
        avatarUrl: avatarUrl || undefined,
      };
    } else if (!byUser[userId].roles.includes(role)) {
      byUser[userId].roles.push(role);
      if (!byUser[userId].avatarUrl && avatarUrl) {
        byUser[userId].avatarUrl = avatarUrl;
      }
      if (!byUser[userId].apelido && apelido) {
        byUser[userId].apelido = apelido;
      }
    }
  }

  return Object.values(byUser).sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
}

function buildSyntheticPerformancesForScoutAnalytics(performances) {
  const scoutPerfs = (performances || []).filter(hasScoutApontamentoSaved);
  const source = scoutPerfs.length ? scoutPerfs : performances || [];
  if (typeof buildMergedScoutStatsByParticipantId !== 'function' || !source.length) {
    return source;
  }
  const merged = buildMergedScoutStatsByParticipantId(source);
  if (!merged.size) {
    return source;
  }
  const rows = [];
  for (const [userId, stats] of merged.entries()) {
    const perf = new Parse.Object('EventPerformance');
    perf.set('participantUserId', userId);
    for (const field of SCOUT_APONTAMENTO_FIELDS) {
      if (field === 'goals') continue;
      perf.set(field, Number(stats[field] || 0));
    }
    perf.set('goals', Number(stats.goals || 0));
    rows.push(perf);
  }
  return rows.length ? rows : source;
}

async function buildMuralPerformanceAnalyticsPayload(scope, scopeId, performances) {
  performances = buildSyntheticPerformancesForScoutAnalytics(performances);
  let totalShotsOn = 0;
  let totalShotsOff = 0;
  let totalGoals = 0;
  let totalPassesOk = 0;
  let totalPassesMiss = 0;
  let totalFouls = 0;
  const athleteIds = new Set();
  const goalTypes = {};
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    goalTypes[field] = 0;
  }

  for (const perf of performances) {
    const userId = getPerformanceParticipantId(perf);
    if (userId) athleteIds.add(userId);
    const stats = mapPerformanceToScoutStats(perf);
    totalShotsOn += Number(stats.shotsOnTarget || 0);
    totalShotsOff += Number(stats.shotsOffTarget || 0);
    totalGoals += Number(stats.goals || 0);
    totalPassesOk += Number(stats.passesCompleted || 0);
    totalPassesMiss += Number(stats.passesMissed || 0);
    totalFouls += Number(stats.foulsCommitted || 0);
    for (const field of SCOUT_GOAL_TYPE_FIELDS) {
      goalTypes[field] += Number(stats[field] || 0);
    }
  }

  const totalShots = totalShotsOn + totalShotsOff;
  const totalPasses = totalPassesOk + totalPassesMiss;

  const analytics = {
    qualitative: {
      shotsOnTarget: buildPerformanceTopEntries(performances, 'shotsOnTarget'),
      totalShots: buildPerformanceTopEntries(performances, 'totalShots'),
      assists: buildPerformanceTopEntries(performances, 'assists'),
    },
    quantitative: {
      totalShots: buildPerformanceTopEntries(performances, 'totalShots'),
      passesCompleted: buildPerformanceTopEntries(performances, 'passesCompleted'),
      foulsSuffered: buildPerformanceTopEntries(performances, 'foulsSuffered'),
      foulsCommitted: buildPerformanceTopEntries(performances, 'foulsCommitted'),
      passesMissed: buildPerformanceTopEntries(performances, 'passesMissed'),
    },
    charts: {
      shotsOnTarget: totalShotsOn,
      shotsOffTarget: totalShotsOff,
      goals: totalGoals,
      totalShots,
      totalPasses,
      passesCompleted: totalPassesOk,
      shotAccuracyPct: totalShots ? Math.round((totalShotsOn / totalShots) * 100) : 0,
      goalConversionPct: totalShotsOn ? Math.round((totalGoals / totalShotsOn) * 100) : 0,
      passAccuracyPct: totalPasses ? Math.round((totalPassesOk / totalPasses) * 100) : 0,
      foulsCommitted: totalFouls,
      athleteCount: athleteIds.size,
    },
    goalTypes,
  };

  return enrichMuralPerformanceAnalytics(scope, scopeId, analytics);
}

async function computePredictionRankingEntries(scope, scopeId, limit, bucket = 'merged') {
  let events = await loadFinishedEventsForPredictionScope(scope, scopeId);
  if (bucket === 'pelada') {
    events = events.filter((event) => event.get('type') !== 'team_match');
  } else if (bucket === 'team_match') {
    events = events.filter((event) => event.get('type') === 'team_match');
  }
  if (!events.length) {
    return [];
  }

  const actualByEventId = new Map();
  for (const event of events) {
    actualByEventId.set(event.id, await buildEventActualPredictionResults(event));
  }

  const predictions = await new Parse.Query('FanPrediction')
    .containedIn('event', events)
    .include('user')
    .limit(5000)
    .find({ useMasterKey: true });

  const scoresByUser = new Map();
  for (const prediction of predictions) {
    const event = prediction.get('event');
    if (!event || !event.id) continue;
    const actual = actualByEventId.get(event.id);

    const predUser = prediction.get('user');
    if (!predUser || !predUser.id) continue;

    const userId = String(predUser.id);
    const existing = scoresByUser.get(userId) || {
      userId,
      totalScore: 0,
      rankingScore: 0,
      eventsCount: 0,
    };

    if (actual && actual.ready) {
      const points = scoreFanPredictionRecord(prediction, actual, event.get('type'));
      existing.totalScore += points;
      let rankingPoints = points;
      if (bucket === 'merged' && event.get('type') === 'team_match') {
        rankingPoints *= TEAM_MATCH_MURAL_WEIGHT;
      }
      existing.rankingScore += rankingPoints;
    }
    existing.eventsCount += 1;
    scoresByUser.set(userId, existing);
  }

  const entries = Array.from(scoresByUser.values())
    .filter((entry) =>
      scope === 'event' || scope === 'pelada' || scope === 'app'
        ? entry.eventsCount > 0
        : entry.totalScore > 0
    )
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      return b.eventsCount - a.eventsCount;
    })
    .slice(0, limit);

  const enriched = await enrichPredictionRankingEntries(entries);
  const ageByUserId = await loadUserAgesForRanking(enriched.map((entry) => entry.userId));
  enriched.sort((a, b) => {
    const aRank = Number(a.rankingScore != null ? a.rankingScore : a.totalScore);
    const bRank = Number(b.rankingScore != null ? b.rankingScore : b.totalScore);
    if (bRank !== aRank) return bRank - aRank;
    if (b.eventsCount !== a.eventsCount) return b.eventsCount - a.eventsCount;
    return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
  });
  return enriched.slice(0, limit).map((entry) => {
    const { rankingScore, ...rest } = entry;
    return rest;
  });
}

Parse.Cloud.define('getMuralAppDashboard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const participantLimit = Math.min(Number(request.params.participantLimit) || 500, 500);
  const scope = 'app';
  const locationFilter = normalizeMuralLocationFilter(request.params);

  const [participants, performanceRaw, voteRowsRaw] = await Promise.all([
    loadRecentAppParticipantRows(participantLimit, locationFilter),
    loadMuralPerformanceRows(scope, undefined, locationFilter),
    mapMuralVoteRowsForScope(scope, undefined, locationFilter),
  ]);

  const voteRows =
    typeof attachVoterReliabilityWeightsFromRows === 'function'
      ? attachVoterReliabilityWeightsFromRows(voteRowsRaw)
      : voteRowsRaw;

  const performanceRows = await mapPerformanceRowsForMural(scope, undefined, performanceRaw);

  const peladaRankingPromise = buildAppPeladaRanking(locationFilter);
  const [bucketMerged, bucketPelada, bucketTeamMatch, peladaRanking] = await Promise.all([
    buildAppMuralBucketPayload(scope, performanceRows, voteRows, performanceRaw, 'merged', locationFilter),
    buildAppMuralBucketPayload(scope, performanceRows, voteRows, performanceRaw, 'pelada', locationFilter),
    buildAppMuralBucketPayload(scope, performanceRows, voteRows, performanceRaw, 'team_match', locationFilter),
    peladaRankingPromise,
  ]);
  bucketMerged.bestPelada = peladaRanking.bestPelada;
  bucketMerged.topPeladas = peladaRanking.topPeladas;
  bucketPelada.bestPelada = peladaRanking.bestPelada;
  bucketPelada.topPeladas = peladaRanking.topPeladas;

  const rankings = bucketMerged.rankings;
  const rankingsPelada = bucketPelada.rankings;
  const rankingsTeamMatch = bucketTeamMatch.rankings;

  const voteAggregates = bucketMerged.voteAggregates;
  const voteAggregatesPelada = bucketPelada.voteAggregates;
  const voteAggregatesTeamMatch = bucketTeamMatch.voteAggregates;
  const participantIds = participants.map((row) => row.userId).filter(Boolean);
  // Com recorte de regiao, as estatisticas de local olham so quem aparece nos eventos filtrados.
  const scopedUserIds = locationFilter.active
    ? new Set(
        [
          ...participantIds,
          ...performanceRows.map((row) => String(row.userId || '')),
          ...voteRows.map((row) => String(row.targetUserId || '')),
        ].filter(Boolean)
      )
    : null;
  const statsUserIds =
    scopedUserIds || (await collectMuralStatsUserIds(scope, undefined, participantIds));
  const statsIdList = Array.from(statsUserIds);
  const statsUsers = [];

  for (let i = 0; i < statsIdList.length; i += 100) {
    const batch = statsIdList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    statsUsers.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const locationStats = buildMuralParticipantLocationStats(statsUsers, true);

  let fullRankings = buildPeladaMuralRankings(performanceRows, voteRows, 10000);
  fullRankings = await enrichMuralRankingNames(scope, undefined, fullRankings);
  const locationUserIds = scopedUserIds || (await collectAppParticipantUserIdsForStats());
  const locationUsers = [];
  const locationIdList = Array.from(locationUserIds);

  for (let i = 0; i < locationIdList.length; i += 100) {
    const batch = locationIdList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    locationUsers.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const locationTopRankings = locationUserIds.size
    ? buildMuralLocationTopRankingsFromUsers(locationUsers, fullRankings, true)
    : {
        byState: [],
        byCity: [],
        byNeighborhood: [],
      };

  const performanceAnalytics = await buildMuralPerformanceAnalyticsPayload(
    scope,
    undefined,
    performanceRaw
  );

  return {
    participants,
    rankings,
    rankingsPelada,
    rankingsTeamMatch,
    voteAggregates,
    voteAggregatesPelada,
    voteAggregatesTeamMatch,
    locationStats,
    locationTopRankings,
    performanceAnalytics,
    predictionRankings: bucketMerged.predictionRankings,
    buckets: {
      merged: bucketMerged,
      pelada: bucketPelada,
      team_match: bucketTeamMatch,
    },
    rankingsMeta: {
      tieBreak: 'older_age',
      confrontoWeight: TEAM_MATCH_MURAL_WEIGHT,
    },
    appliedLocation: {
      state: locationFilter.state,
      city: locationFilter.city,
      neighborhood: locationFilter.neighborhood,
    },
  };
});

Parse.Cloud.define('getEventMuralDashboard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const rawVotes = await loadMuralVoteRows('event', eventId);
  await backfillEventMuralVoteSnapshots(rawVotes, eventId);
  const voteRows = await mapMuralVoteRowsForScope('event', eventId);
  const voterIds = new Set();
  for (const vote of voteRows) {
    if (vote.voterId) voterIds.add(vote.voterId);
  }
  const totalParticipants = (await collectEventParticipantUserIds(eventId)).size;
  const voterCount = voterIds.size;
  const votePercentage =
    totalParticipants > 0 ? Math.round((voterCount / totalParticipants) * 1000) / 10 : 0;

  const voterQuorumMet = meetsEventVoterQuorum(voterCount);
  // Sempre retorna rankings reais; o quorum so alimenta a nota de integridade no app.
  const rankings = await finalizeEventGoalkeeperRankings(
    await enrichMuralRankingNames(
      'event',
      eventId,
      buildEventVoteRankings(voteRows)
    )
  );

  const participants = await loadEventMuralParticipantRows(eventId);
  enrichRankingsWithParticipantMeta(rankings, participants);

  const users = [];
  const participantIds = participants.map((row) => row.userId).filter(Boolean);
  for (let i = 0; i < participantIds.length; i += 100) {
    const batch = participantIds.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }
  let locationStats = buildMuralParticipantLocationStats(users, false);
  if (!locationStats.total) {
    locationStats = buildLocationStatsFromParticipantRows(participants);
  }

  const myVotes = (await listMyEventMuralVoteRows(eventId, request.user.id)).map((vote) =>
    mapMyEventMuralVoteRow(
      vote,
      new Map(participants.map((row) => [row.userId, row]))
    )
  );

  return {
    rankings,
    voteSummary: {
      totalVotes: voteRows.length,
      voterCount,
      totalParticipants,
      votePercentage,
      voterQuorumMet,
      minVoters: INTEGRITY_MIN_EVENT_VOTERS,
    },
    participants,
    locationStats,
    myVotes,
  };
});

Parse.Cloud.define('listMyEventMuralVotes', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const participants = await loadEventMuralParticipantRows(eventId);
  const participantById = new Map(participants.map((row) => [row.userId, row]));
  const votes = await listMyEventMuralVoteRows(eventId, request.user.id);
  return votes.map((vote) => mapMyEventMuralVoteRow(vote, participantById));
});

Parse.Cloud.define('getEventMuralVoteSummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const votes = dedupeMuralVoteRowsByVoter(
    (await loadMuralVoteRows('event', eventId)).map(mapVoteRow)
  );
  const voterIds = new Set();
  for (const vote of votes) {
    if (vote.voterId) voterIds.add(vote.voterId);
  }

  const totalParticipants = (await collectEventParticipantUserIds(eventId)).size;
  const voterCount = voterIds.size;
  const votePercentage =
    totalParticipants > 0
      ? Math.round((voterCount / totalParticipants) * 1000) / 10
      : 0;

  return {
    totalVotes: votes.length,
    voterCount,
    totalParticipants,
    votePercentage,
    voterQuorumMet: meetsEventVoterQuorum(voterCount),
    minVoters: INTEGRITY_MIN_EVENT_VOTERS,
  };
});

function muralParticipantHeightEligible(row) {
  const roles = row.roles || [];
  return roles.includes('athlete') || roles.includes('goalkeeper');
}

function buildMuralShowcaseFromParticipantRow(row, score, scoreLabel) {
  if (!row || !row.userId) return null;
  return {
    userId: String(row.userId),
    displayName: (row.apelido || row.userName || 'Participante').trim(),
    avatarUrl: row.avatarUrl || undefined,
    profileLabel: 'Atleta',
    favoriteProTeam: row.favoriteProTeam || undefined,
    favoriteAmateurTeam: row.favoriteAmateurTeam || undefined,
    proFootballIdol: row.proFootballIdol || undefined,
    amateurFootballIdol: row.amateurFootballIdol || undefined,
    score,
    scoreLabel,
  };
}

function buildEventMuralCuriositiesFromRows(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const teamName = String(row.favoriteAmateurTeam || '').trim();
    if (!teamName || teamName.toLowerCase() === 'sem time') continue;
    counts.set(teamName, (counts.get(teamName) || 0) + 1);
  }
  let favoriteAmateurTeam = null;
  const sortedTeams = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'pt-BR');
  });
  if (sortedTeams.length) {
    favoriteAmateurTeam = { teamName: sortedTeams[0][0], count: sortedTeams[0][1] };
  }

  const heightRows = [];
  for (const row of rows || []) {
    if (!muralParticipantHeightEligible(row)) continue;
    const heightCm = Number(row.heightCm || 0);
    if (heightCm > 0) {
      heightRows.push({ row, heightCm });
    }
  }
  heightRows.sort((a, b) => {
    const diff = a.heightCm - b.heightCm;
    if (diff !== 0) return diff;
    const nameA = (a.row.apelido || a.row.userName || '').trim();
    const nameB = (b.row.apelido || b.row.userName || '').trim();
    return nameA.localeCompare(nameB, 'pt-BR');
  });

  const shortest = heightRows.length
    ? buildMuralShowcaseFromParticipantRow(
        heightRows[0].row,
        heightRows[0].heightCm,
        'Altura (cm)'
      )
    : null;
  const tallest = heightRows.length
    ? buildMuralShowcaseFromParticipantRow(
        heightRows[heightRows.length - 1].row,
        heightRows[heightRows.length - 1].heightCm,
        'Altura (cm)'
      )
    : null;

  return {
    participants: rows,
    favoriteAmateurTeam,
    tallest,
    shortest,
  };
}

Parse.Cloud.define('getEventMuralCuriosities', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const rows = await loadEventMuralParticipantRows(eventId);
  return buildEventMuralCuriositiesFromRows(rows);
});

Parse.Cloud.define('listEventMuralParticipants', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  return loadEventMuralParticipantRows(eventId);
});

/** Uma cedula por conta Parse (voter), independente de quantas inscricoes/perfis no evento. */
async function assertConfirmedEventVoter(user, event) {
  const ownRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (!ownRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes inscritos podem votar neste evento.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(ownRegistration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes com inscricao confirmada podem votar.'
    );
  }

  return ownRegistration;
}

async function voterHasEventMuralVotes(eventId, voterId, period) {
  const voter = Parse.User.createWithoutData(voterId);
  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', 'event');
  query.equalTo('scopeId', eventId);
  query.equalTo('voter', voter);
  query.equalTo('period', period);
  query.limit(1);
  return !!(await query.first({ useMasterKey: true }));
}

async function createEventMuralVoteForTarget(user, event, eventId, period, entry) {
  const partOfBallot = entry._ballotBatch === true;
  if (!partOfBallot && (await voterHasEventMuralVotes(eventId, user.id, period))) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Um voto por conta; trocar de perfil no app nao permite votar de novo neste evento.'
    );
  }

  const registrationId = entry.registrationId ? String(entry.registrationId) : '';
  const targetRole = entry.targetRole ? String(entry.targetRole) : '';
  const score = Number(entry.score);

  if (!registrationId || !targetRole) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'registrationId e targetRole sao obrigatorios.'
    );
  }

  if (Number.isNaN(score) || score < 0 || score > 10) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'A nota deve ser entre 0 e 10.');
  }

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .include('user')
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }

  const resolved = await resolveRegistrationParticipantUserId(registration);
  if (!resolved.userId) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Nao foi possivel identificar o participante desta inscricao.'
    );
  }

  assertNotSelfMuralVote(user.id, resolved.userId);

  if (resolved.shouldSave) {
    await registration.save(null, { useMasterKey: true });
  }

  const athleteProfileResult = await resolveRegistrationAthleteProfile(registration);
  const athlete = athleteProfileResult.athlete;
  if (athleteProfileResult.shouldSave) {
    await registration.save(null, { useMasterKey: true });
  }

  const registrationRole = registration.get('role') || 'athlete';
  const position =
    registration.get('primaryPosition') ||
    (athlete && athlete.get ? athlete.get('primaryPosition') : '');

  if (!MURAL_TARGET_ROLES.includes(targetRole)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Papel de votacao invalido.');
  }

  let effectiveTargetRole = targetRole;
  if (registrationRole === 'goalkeeper' || isGoalkeeperPosition(position)) {
    effectiveTargetRole = 'goalkeeper';
  } else if (registrationRole === 'athlete') {
    effectiveTargetRole = 'athlete';
  } else if (registrationRole === 'fan' || registrationRole === 'gatekeeper') {
    effectiveTargetRole = registrationRole;
  } else if (MURAL_TARGET_ROLES.includes(registrationRole)) {
    effectiveTargetRole = registrationRole;
  }

  if (effectiveTargetRole !== targetRole && registrationRole !== 'athlete') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'O papel da votacao nao corresponde ao perfil do participante.'
    );
  }

  const voter = Parse.User.createWithoutData(user.id);
  const targetUser = Parse.User.createWithoutData(resolved.userId);

  if (effectiveTargetRole === 'goalkeeper') {
    const legacyAthleteVoteQuery = new Parse.Query('MuralVote');
    legacyAthleteVoteQuery.equalTo('scope', 'event');
    legacyAthleteVoteQuery.equalTo('scopeId', eventId);
    legacyAthleteVoteQuery.equalTo('voter', voter);
    legacyAthleteVoteQuery.equalTo('targetUser', targetUser);
    legacyAthleteVoteQuery.equalTo('targetRole', 'athlete');
    legacyAthleteVoteQuery.equalTo('period', period);
    const legacyAthleteVote = await legacyAthleteVoteQuery.first({ useMasterKey: true });
    if (legacyAthleteVote) {
      await legacyAthleteVote.destroy({ useMasterKey: true });
    }
  }

  const existingQuery = new Parse.Query('MuralVote');
  existingQuery.equalTo('scope', 'event');
  existingQuery.equalTo('scopeId', eventId);
  existingQuery.equalTo('voter', voter);
  existingQuery.equalTo('targetUser', targetUser);
  existingQuery.equalTo('targetRole', effectiveTargetRole);
  existingQuery.equalTo('period', period);
  const existing = await existingQuery.first({ useMasterKey: true });
  if (existing) {
    return {
      objectId: existing.id,
      targetUserId: resolved.userId,
      targetRole: effectiveTargetRole,
      alreadyExisted: true,
    };
  }

  const vote = new Parse.Object('MuralVote');
  vote.set('scope', 'event');
  vote.set('scopeId', eventId);
  vote.set('voter', voter);
  vote.set('targetUser', targetUser);
  vote.set('targetRole', effectiveTargetRole);
  vote.set('score', score);
  vote.set('period', period);
  applyEventMuralVoteSnapshot(vote, registration, resolved.userId);
  vote.setACL(buildMuralVoteACL(user.id));
  await vote.save(null, { useMasterKey: true });
  return {
    objectId: vote.id,
    targetUserId: resolved.userId,
    targetRole: effectiveTargetRole,
    alreadyExisted: false,
  };
}

Parse.Cloud.define('submitEventMuralBallot', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const period = request.params.period ? String(request.params.period) : eventId;
  const entries = Array.isArray(request.params.votes) ? request.params.votes : [];

  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  if (!entries.length) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Atribua nota de 0 a 10 para ao menos um participante.'
    );
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  assertEventVotingWindowOpen(event);
  await assertConfirmedEventVoter(user, event);

  if (await voterHasEventMuralVotes(eventId, user.id, period)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Sua votacao ja foi registrada e nao pode ser alterada.'
    );
  }

  assertEventMuralBallotScoreTenLimit(entries);

  const created = [];
  const seenTargets = new Set();
  for (const entry of entries.slice(0, 200)) {
    const result = await createEventMuralVoteForTarget(user, event, eventId, period, {
      ...entry,
      _ballotBatch: true,
    });
    const dedupeKey = result.targetUserId + ':' + result.targetRole;
    if (seenTargets.has(dedupeKey)) continue;
    seenTargets.add(dedupeKey);
    if (!result.alreadyExisted) created.push(result.objectId);
  }

  return { ok: true, voteCount: created.length, objectIds: created };
});

Parse.Cloud.define('castEventMuralVote', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const period = request.params.period ? String(request.params.period) : eventId;

  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  assertEventVotingWindowOpen(event);
  await assertConfirmedEventVoter(user, event);

  if (await voterHasEventMuralVotes(eventId, user.id, period)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Sua votacao ja foi registrada e nao pode ser alterada.'
    );
  }

  const result = await createEventMuralVoteForTarget(user, event, eventId, period, request.params);
  return { ok: true, objectId: result.objectId };
});

// Permissoes de classes e backfills
async function updateClassCLP(className, clp) {
  const schema = new Parse.Schema(className);
  schema.setCLP(clp);
  await schema.update();
}

Parse.Cloud.define('configureMuralClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authReadWrite = { requiresAuthentication: true };
  const authRead = { requiresAuthentication: true };
  const authAddField = { requiresAuthentication: true };

  await updateClassCLP('EventRegistration', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('MuralVote', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: {},
    update: {},
    delete: {},
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('EventPerformance', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('FanPrediction', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('AthleteProfile', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('RoleProfile', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('FanProfile', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('RefereeInvitation', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('Event', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('_User', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: { '*': true },
    update: { requiresAuthentication: true },
    addField: authAddField,
    protectedFields: {
      email: [],
      authData: [],
    },
  });

  const performanceAclUpdated = await backfillEventPerformanceACLs();
  const roleProfileAclUpdated = await backfillRoleProfileHiringACLs();

  return {
    ok: true,
    performanceAclUpdated,
    roleProfileAclUpdated,
    message:
      'CLP atualizado para mural, contratacoes e busca de perfis (AthleteProfile, RoleProfile, FanProfile, EventRegistration, RefereeInvitation, Event, EventPerformance).',
  };
});

async function backfillRoleProfileHiringACLs() {
  let updated = 0;
  let skip = 0;
  const batchSize = 100;

  while (true) {
    const batch = await new Parse.Query('RoleProfile')
      .skip(skip)
      .limit(batchSize)
      .find({ useMasterKey: true });
    if (!batch.length) break;

    for (const profile of batch) {
      const user = profile.get('user');
      if (user && user.id && !profile.get('userId')) {
        profile.set('userId', user.id);
      }
      const acl = new Parse.ACL();
      acl.setPublicReadAccess(true);
      if (user && user.id) {
        acl.setWriteAccess(user, true);
      }
      profile.setACL(acl);
    }

    await Parse.Object.saveAll(batch, { useMasterKey: true });
    updated += batch.length;
    skip += batch.length;
    if (batch.length < batchSize) break;
  }

  return updated;
}

async function backfillEventPerformanceACLs() {
  let updated = 0;
  let skip = 0;
  const batchSize = 100;

  while (true) {
    const query = new Parse.Query('EventPerformance');
    query.limit(batchSize);
    query.skip(skip);
    const rows = await query.find({ useMasterKey: true });
    if (!rows.length) break;

    const toSave = [];
    for (const perf of rows) {
      ensureEventPerformanceReadACL(perf);
      toSave.push(perf);
    }
    if (toSave.length) {
      await Parse.Object.saveAll(toSave, { useMasterKey: true });
      updated += toSave.length;
    }

    if (rows.length < batchSize) break;
    skip += batchSize;
  }

  return updated;
}

Parse.Cloud.define('backfillEventPerformanceACLs', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const updated = await backfillEventPerformanceACLs();
  return { ok: true, updated };
});

Parse.Cloud.define('backfillEventMuralVoteSnapshots', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', 'event');
  if (eventId) {
    query.equalTo('scopeId', eventId);
  }
  query.limit(3000);
  const votes = await query.find({ useMasterKey: true });

  const eventIds = eventId
    ? [eventId]
    : [...new Set(votes.map((vote) => vote.get('scopeId')).filter(Boolean))];

  let updated = 0;
  for (const id of eventIds) {
    const scopedVotes = votes.filter((vote) => vote.get('scopeId') === id);
    const before = scopedVotes.filter((vote) => !vote.get('targetDisplayName')).length;
    await backfillEventMuralVoteSnapshots(scopedVotes, id);
    const after = scopedVotes.filter((vote) => !vote.get('targetDisplayName')).length;
    updated += Math.max(0, before - after);
  }

  return {
    ok: true,
    eventsProcessed: eventIds.length,
    votesScanned: votes.length,
    votesUpdated: updated,
  };
});

// Analytics de performance
function buildPerformanceTopEntries(performances, field, topN = 3) {
  const byUser = new Map();
  for (const perf of performances) {
    const userId = getPerformanceParticipantId(perf);
    if (!userId) continue;
    let value = 0;
    if (field === 'goals') {
      // Reflete sumula do arbitro assim que salva (refereeGoals com prioridade).
      value = resolveEffectiveGoalsForCounting(perf, 'referee');
    } else if (field === 'totalShots') {
      const stats = mapPerformanceToScoutStats(perf);
      value = Number(stats.shotsOnTarget || 0) + Number(stats.shotsOffTarget || 0);
    } else {
      const stats = mapPerformanceToScoutStats(perf);
      value = Number(stats[field] || 0);
    }
    if (!value) continue;
    byUser.set(userId, (byUser.get(userId) || 0) + value);
  }
  return Array.from(byUser.entries())
    .map(([userId, total]) => ({ userId, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
}

async function enrichMuralPerformanceAnalytics(scope, scopeId, analytics) {
  const userIds = new Set();
  const collectIds = (entries) => {
    for (const entry of entries || []) {
      if (entry && entry.userId) userIds.add(entry.userId);
    }
  };

  collectIds(analytics.qualitative && analytics.qualitative.shotsOnTarget);
  collectIds(analytics.qualitative && analytics.qualitative.totalShots);
  collectIds(analytics.qualitative && analytics.qualitative.assists);
  collectIds(analytics.quantitative && analytics.quantitative.totalShots);
  collectIds(analytics.quantitative && analytics.quantitative.passesCompleted);
  collectIds(analytics.quantitative && analytics.quantitative.foulsSuffered);
  collectIds(analytics.quantitative && analytics.quantitative.foulsCommitted);
  collectIds(analytics.quantitative && analytics.quantitative.passesMissed);

  if (!userIds.size) return analytics;

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }
  const userById = new Map(users.map((user) => [user.id, user]));

  const registrationNames = new Map();
  const registrationAvatars = new Map();

  if (scope === 'event' && scopeId) {
    const event = Parse.Object.extend('Event').createWithoutData(scopeId);
    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .include('user')
      .limit(500)
      .find({ useMasterKey: true });
    for (const registration of registrations) {
      const resolved = await resolveRegistrationParticipantUserId(registration);
      if (!resolved.userId) continue;
      const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
      const displayName =
        apelido ||
        (registration.get('userDisplayName') || '').trim() ||
        (registration.get('userFullName') || '').trim();
      if (displayName) registrationNames.set(resolved.userId, displayName);
      const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
      if (avatarUrl) registrationAvatars.set(resolved.userId, avatarUrl);
    }
  } else if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    for (const event of events) {
      const registrations = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .include('user')
        .limit(500)
        .find({ useMasterKey: true });
      for (const registration of registrations) {
        const resolved = await resolveRegistrationParticipantUserId(registration);
        if (!resolved.userId) continue;
        const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
        const displayName =
          apelido ||
          (registration.get('userDisplayName') || '').trim() ||
          (registration.get('userFullName') || '').trim();
        if (displayName && !registrationNames.has(resolved.userId)) {
          registrationNames.set(resolved.userId, displayName);
        }
        const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
        if (avatarUrl && !registrationAvatars.has(resolved.userId)) {
          registrationAvatars.set(resolved.userId, avatarUrl);
        }
      }
    }
  }

  const profileByUserId = new Map();
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const profileQuery = new Parse.Query('AthleteProfile');
    profileQuery.containedIn(
      'user',
      batch.map((id) => Parse.User.createWithoutData(id))
    );
    profileQuery.limit(100);
    const profiles = await profileQuery.find({ useMasterKey: true });
    for (const profile of profiles) {
      const user = profile.get('user');
      const userId = user && user.id ? user.id : profile.get('userId');
      if (userId) profileByUserId.set(String(userId), profile);
    }
  }

  const enrichEntry = (entry) => {
    if (!entry || !entry.userId) return entry;
    const user = userById.get(entry.userId);
    const profile = profileByUserId.get(entry.userId);
    const apelido =
      registrationNames.get(entry.userId) ||
      (user && user.get ? (user.get('apelido') || '').trim() : '') ||
      (profile && profile.get ? (profile.get('userApelido') || '').trim() : '') ||
      '';
    const fullName =
      (user && user.get ? (user.get('name') || '').trim() : '') ||
      (profile && profile.get ? (profile.get('userName') || '').trim() : '') ||
      (user && user.getUsername ? user.getUsername() : '') ||
      '';
    const userName = apelido || fullName || entry.userId;
    const avatarUrl =
      registrationAvatars.get(entry.userId) ||
      resolveStoredAvatarUrl(user) ||
      (profile && profile.get ? profile.get('userAvatarUrl') : undefined) ||
      entry.avatarUrl;
    return {
      ...entry,
      userName,
      apelido: apelido || undefined,
      avatarUrl: avatarUrl || undefined,
      primaryPosition: profile && profile.get ? profile.get('primaryPosition') || undefined : undefined,
      footPreference: profile && profile.get ? profile.get('footPreference') || undefined : undefined,
    };
  };

  const enrichList = (entries) => (entries || []).map(enrichEntry);

  return {
    ...analytics,
    qualitative: {
      shotsOnTarget: enrichList(analytics.qualitative && analytics.qualitative.shotsOnTarget),
      totalShots: enrichList(analytics.qualitative && analytics.qualitative.totalShots),
      assists: enrichList(analytics.qualitative && analytics.qualitative.assists),
    },
    quantitative: {
      totalShots: enrichList(analytics.quantitative && analytics.quantitative.totalShots),
      passesCompleted: enrichList(analytics.quantitative && analytics.quantitative.passesCompleted),
      foulsSuffered: enrichList(analytics.quantitative && analytics.quantitative.foulsSuffered),
      foulsCommitted: enrichList(analytics.quantitative && analytics.quantitative.foulsCommitted),
      passesMissed: enrichList(analytics.quantitative && analytics.quantitative.passesMissed),
    },
  };
}

Parse.Cloud.define('getMuralPerformanceAnalytics', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const performances = await loadMuralPerformanceRows(scope, scopeId);
  return buildMuralPerformanceAnalyticsPayload(scope, scopeId, performances);
});

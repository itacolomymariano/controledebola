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

async function mapMuralVoteRowsForScope(scope, scopeId) {
  const goalkeeperUserIds = await loadGoalkeeperUserIdsForMuralScope(scope, scopeId);
  const rawVotes = await loadMuralVoteRows(scope, scopeId);
  const mapped = rawVotes.map((vote) =>
    normalizeVoteRowTargetRole(mapVoteRow(vote), goalkeeperUserIds)
  );
  return dedupeMuralVoteRowsByVoter(mapped);
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

async function loadMuralVoteRows(scope, scopeId) {
  if (scope === 'app') {
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

async function loadMuralPerformanceRows(scope, scopeId) {
  if (scope === 'app') {
    return new Parse.Query('EventPerformance').limit(3000).find({ useMasterKey: true });
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
  };
}

async function mapPerformanceRowsForMural(scope, scopeId, performances) {
  let scopeDefaultPriority;
  if (scope === 'pelada' && scopeId) {
    scopeDefaultPriority = await loadPeladaStatsConflictSource(scopeId);
  }
  const conflictMap = await buildPeladaStatsConflictMapFromPerformances(performances);
  return performances.map((perf) => mapPerformanceRow(perf, conflictMap, scopeDefaultPriority));
}

function buildLocationStatsFromParticipantRows(participants) {
  const byCity = new Map();
  const byNeighborhood = new Map();
  let total = 0;

  for (const row of participants) {
    const address = row.address || {};
    const city = normalizeLocationLabel(address.city);
    const neighborhood = normalizeLocationLabel(address.neighborhood);
    const state = normalizeLocationLabel(address.state).toUpperCase();
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
  };
}

function muralRankingDisplayScore(entry) {
  const voteCount = Number(entry.voteCount || 0);
  const totalScore = Number(entry.totalScore || 0);
  const combinedScore = Number(entry.combinedScore || 0);
  return voteCount > 0 ? totalScore : combinedScore;
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
    const current = voteAgg.get(key) || { total: 0, count: 0 };
    current.total += vote.score;
    current.count += 1;
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
      const voteData = voteAgg.get(perfKey) || { total: 0, count: 0 };
      if (voteData.count === 0 && performanceScore === 0) continue;
      const averageScore = voteData.count > 0 ? voteData.total / voteData.count : 0;
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
      const eventAgg = userData.events.get(eventId) || { sum: 0, count: 0 };
      eventAgg.sum += Number(vote.score) || 0;
      eventAgg.count += 1;
      userData.events.set(eventId, eventAgg);
      userData.voteCount += 1;
    }

    const entries = Array.from(byUser.entries())
      .map(([userId, data]) => {
        const eventAverages = [];
        for (const eventAgg of data.events.values()) {
          if (eventAgg.count > 0) {
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
        userName: vote.targetUserName || 'Participante',
      };
      current.total += vote.score;
      current.count += 1;
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
        averageScore: data.count > 0 ? data.total / data.count : 0,
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

function extractUserLocationKeys(user, includeState) {
  const address = user.get('address') || {};
  const state = normalizeLocationLabel(address.state).toUpperCase();
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
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .limit(500)
    .find({ useMasterKey: true });

  const byUser = {};
  const toSave = [];

  for (const registration of registrations) {
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

function buildMuralParticipantProfile(user, athleteProfile, amateurTeam) {
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
      athleteProfile ? athleteProfile.get('favoriteProTeam') : undefined
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
        teamByPresidentId.get(user.id)
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
    const state = normalizeLocationLabel(address.state).toUpperCase();
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

// Highlights, dashboards e votacao do evento
Parse.Cloud.define('getMuralHighlightPerformances', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const rawPerformances = await loadMuralPerformanceRows(scope, scopeId);
  const conflictMap = await buildPeladaStatsConflictMapFromPerformances(rawPerformances);
  const goalsByEventUser = new Map();
  const byUserId = new Map();

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
    const eventUserKey = `${eventId}:${userId}`;
    const currentEventGoals = goalsByEventUser.get(eventUserKey) ?? 0;
    goalsByEventUser.set(eventUserKey, Math.max(currentEventGoals, goals));
  }

  for (const [eventUserKey, goals] of goalsByEventUser.entries()) {
    const userId = eventUserKey.split(':').slice(1).join(':');
    if (!userId) continue;
    const current = byUserId.get(userId) || { userId, role: 'athlete', goals: 0 };
    current.goals += goals;
    byUserId.set(userId, current);
  }

  return Array.from(byUserId.values());
});

function buildMuralVoteAggregatesFromRows(voteRows) {
  const result = {};
  for (const role of MURAL_TARGET_ROLES) {
    result[role] = {};
  }
  for (const vote of dedupeMuralVoteRowsByVoter(voteRows)) {
    if (!vote.targetUserId) continue;
    const role = vote.targetRole;
    if (!result[role]) continue;
    const current = result[role][vote.targetUserId] || {
      totalScore: 0,
      voteCount: 0,
      userName: vote.targetUserName || 'Participante',
    };
    current.totalScore += vote.score;
    current.voteCount += 1;
    if (vote.targetUserName && vote.targetUserName !== 'Participante') {
      current.userName = vote.targetUserName;
    }
    result[role][vote.targetUserId] = current;
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

async function loadRecentAppParticipantRows(limit) {
  const cap = Math.min(Number(limit) || 500, 500);
  const registrations = await new Parse.Query('EventRegistration')
    .descending('createdAt')
    .include('user')
    .limit(cap)
    .find({ useMasterKey: true });

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

async function buildMuralPerformanceAnalyticsPayload(scope, scopeId, performances) {
  let totalShotsOn = 0;
  let totalShotsOff = 0;
  let totalGoals = 0;
  let totalPassesOk = 0;
  let totalPassesMiss = 0;
  let totalFouls = 0;
  const athleteIds = new Set();

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
  };

  return enrichMuralPerformanceAnalytics(scope, scopeId, analytics);
}

async function computePredictionRankingEntries(scope, scopeId, limit) {
  const events = await loadFinishedEventsForPredictionScope(scope, scopeId);
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
      eventsCount: 0,
    };

    if (actual && actual.ready) {
      existing.totalScore += scoreFanPredictionRecord(prediction, actual, event.get('type'));
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
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.eventsCount - a.eventsCount;
    })
    .slice(0, limit);

  return enrichPredictionRankingEntries(entries);
}

Parse.Cloud.define('getMuralAppDashboard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const participantLimit = Math.min(Number(request.params.participantLimit) || 500, 500);
  const scope = 'app';

  const [participants, performanceRaw, voteRows] = await Promise.all([
    loadRecentAppParticipantRows(participantLimit),
    loadMuralPerformanceRows(scope),
    mapMuralVoteRowsForScope(scope),
  ]);

  const performanceRows = await mapPerformanceRowsForMural(scope, undefined, performanceRaw);

  let rankings = buildPeladaMuralRankings(performanceRows, voteRows, 10);
  rankings = await enrichMuralRankingNames(scope, undefined, rankings);
  rankings = await finalizeEventGoalkeeperRankings(rankings);

  const voteAggregates = buildMuralVoteAggregatesFromRows(voteRows);
  const participantIds = participants.map((row) => row.userId).filter(Boolean);
  const statsUserIds = await collectMuralStatsUserIds(scope, undefined, participantIds);
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
  const locationUserIds = await collectAppParticipantUserIdsForStats();
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

  const [performanceAnalytics, predictionRankings] = await Promise.all([
    buildMuralPerformanceAnalyticsPayload(scope, undefined, performanceRaw),
    computePredictionRankingEntries(scope, undefined, 10),
  ]);

  return {
    participants,
    rankings,
    voteAggregates,
    locationStats,
    locationTopRankings,
    performanceAnalytics,
    predictionRankings,
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

  let effectiveTargetRole = targetRole;
  if (registrationRole === 'goalkeeper' || isGoalkeeperPosition(position)) {
    effectiveTargetRole = 'goalkeeper';
  } else if (registrationRole === 'athlete') {
    effectiveTargetRole = 'athlete';
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

  const created = [];
  const seenTargets = new Set();
  for (const entry of entries.slice(0, 200)) {
    const result = await createEventMuralVoteForTarget(user, event, eventId, period, entry);
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
    const stats = mapPerformanceToScoutStats(perf);
    let value = 0;
    if (field === 'totalShots') {
      value = Number(stats.shotsOnTarget || 0) + Number(stats.shotsOffTarget || 0);
    } else {
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

  let totalShotsOn = 0;
  let totalShotsOff = 0;
  let totalGoals = 0;
  let totalPassesOk = 0;
  let totalPassesMiss = 0;
  let totalFouls = 0;
  const athleteIds = new Set();

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
  };

  return enrichMuralPerformanceAnalytics(scope, scopeId, analytics);
});

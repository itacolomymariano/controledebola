/** Scout, sumula do juiz, predicoes e dashboard de performance */

/** Scout, sumula do juiz, predicoes e dashboard de performance */

// Janela de apontamento e sumula
function isEventEndedForTools(event, now = new Date()) {
  if (event.get('isFinished')) return true;
  const endTime = event.get('endTime');
  return endTime instanceof Date && !Number.isNaN(endTime.getTime()) && now > endTime;
}

function isWithinApontamentoWindow(event, fieldPrefix, now = new Date()) {
  const opensAt = event.get(`${fieldPrefix}OpensAt`);
  const closesAt = event.get(`${fieldPrefix}ClosesAt`);
  if (!opensAt && !closesAt) return true;
  if (opensAt && now < opensAt) return false;
  if (closesAt && now > closesAt) return false;
  return true;
}

function assertWithinApontamentoWindow(event, fieldPrefix, label) {
  const opensAt = event.get(`${fieldPrefix}OpensAt`);
  const closesAt = event.get(`${fieldPrefix}ClosesAt`);
  if (!opensAt && !closesAt) return;
  const now = new Date();
  if (opensAt && now < opensAt) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      `${label} ainda nao esta disponivel.`
    );
  }
  if (closesAt && now > closesAt) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      `Periodo de ${label} encerrado.`
    );
  }
}

// ACL e persistencia de EventPerformance
function buildEventPerformanceReadACL() {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setPublicWriteAccess(false);
  return acl;
}

function ensureEventPerformanceReadACL(perf) {
  if (!perf || !perf.setACL) return;
  perf.setACL(buildEventPerformanceReadACL());
}

async function saveEventPerformance(perf) {
  ensureEventPerformanceReadACL(perf);
  return perf.save(null, { useMasterKey: true });
}

// Scout, sumula, predicoes e dashboard do atleta
const SCOUT_APONTAMENTO_FIELDS = [
  'shotsOffTarget',
  'shotsOnTarget',
  'foulsCommitted',
  'foulsCommittedGame',
  'foulsCommittedPenalty',
  'foulsSuffered',
  'foulsSufferedGame',
  'foulsSufferedPenalty',
  'goals',
  'ownGoals',
  'assists',
  'passesCompleted',
  'passesMissed',
  'yellowCards',
  'redCards',
  'goalsHeader',
  'goalsFreeKick',
  'goalsRightFoot',
  'goalsLeftFoot',
  'goalsOlympic',
  'goalsCrazy',
  'goalsPenalty',
  'penaltiesCommitted',
  'penaltiesSuffered',
  'saves',
  'savesPenalty',
  'savesFreeKick',
  'savesOpenPlay',
  'goalsConceded',
  'goalsConcededPenalty',
  'goalsConcededFreeKick',
  'goalsConcededOpenPlay',
  'gkAssistsHand',
  'gkAssistsFeet',
];

const SCOUT_DERIVED_TOTAL_FIELDS = [
  'goals',
  'foulsCommitted',
  'foulsSuffered',
  'saves',
  'goalsConceded',
];

const SCOUT_GOAL_TYPE_FIELDS = [
  'goalsHeader',
  'goalsFreeKick',
  'goalsRightFoot',
  'goalsLeftFoot',
  'goalsOlympic',
  'goalsCrazy',
  'goalsPenalty',
];

const SCOUT_OVERLAP_STORAGE_FIELDS = {
  goals: 'scoutGoals',
  foulsCommitted: 'scoutFoulsCommitted',
  yellowCards: 'scoutYellowCards',
  redCards: 'scoutRedCards',
};

const REFEREE_OVERLAP_STORAGE_FIELDS = {
  goals: 'refereeGoals',
  foulsCommitted: 'refereeFoulsCommitted',
  yellowCards: 'refereeYellowCards',
  redCards: 'refereeRedCards',
};

function normalizeStatsConflictSource(value) {
  return value === 'scout' ? 'scout' : 'referee';
}

async function loadPeladaStatsConflictSource(peladaId) {
  if (!peladaId) return 'referee';
  try {
    const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
    return normalizeStatsConflictSource(pelada.get('statsConflictSource'));
  } catch {
    return 'referee';
  }
}

async function buildPeladaStatsConflictMapFromPerformances(performances) {
  const peladaIds = new Set();
  for (const perf of performances) {
    const pelada = perf.get('pelada');
    if (pelada && pelada.id) {
      peladaIds.add(pelada.id);
    }
  }
  if (!peladaIds.size) {
    return new Map();
  }

  const query = new Parse.Query('Pelada');
  query.containedIn('objectId', Array.from(peladaIds));
  const peladas = await query.find({ useMasterKey: true });
  const map = new Map();
  for (const pelada of peladas) {
    map.set(pelada.id, normalizeStatsConflictSource(pelada.get('statsConflictSource')));
  }
  return map;
}

function collectPerformanceParticipantKeys(perf) {
  const keys = [];
  const participantId = perf.get('participantUserId');
  if (participantId) {
    keys.push(String(participantId));
  }
  const user = perf.get('user');
  if (user && user.id) {
    keys.push(String(user.id));
  }
  return keys;
}

function hasSplitScoutRefereeStats(perf) {
  if (!perf) return false;
  return (
    perf.get('scoutGoals') !== undefined ||
    perf.get('refereeGoals') !== undefined ||
    perf.get('scoutFoulsCommitted') !== undefined ||
    perf.get('refereeFoulsCommitted') !== undefined
  );
}

function readScoutOverlapStat(perf, field) {
  const storageField = SCOUT_OVERLAP_STORAGE_FIELDS[field];
  if (!storageField) {
    return Number(perf.get(field) || 0);
  }
  const explicit = perf.get(storageField);
  if (explicit !== undefined && explicit !== null) {
    return Number(explicit) || 0;
  }
  return Number(perf.get(field) || 0);
}

function readRefereeOverlapStat(perf, field) {
  const storageField = REFEREE_OVERLAP_STORAGE_FIELDS[field];
  if (!storageField) {
    return 0;
  }
  const explicit = perf.get(storageField);
  if (explicit !== undefined && explicit !== null) {
    return Number(explicit) || 0;
  }
  if (field === 'foulsCommitted') {
    return Number(perf.get('fouls') || perf.get('foulsCommitted') || 0);
  }
  return Number(perf.get(field) || 0);
}

function resolveEffectivePerformanceStats(perf, priority) {
  if (!perf) {
    return {
      goals: 0,
      assists: 0,
      saves: 0,
      yellowCards: 0,
      redCards: 0,
      foulsCommitted: 0,
    };
  }

  const useReferee = normalizeStatsConflictSource(priority) === 'referee';

  function pickOverlap(field) {
    const storageField = SCOUT_OVERLAP_STORAGE_FIELDS[field];
    const refereeField = REFEREE_OVERLAP_STORAGE_FIELDS[field];
    const hasScoutExplicit =
      storageField &&
      perf.get(storageField) !== undefined &&
      perf.get(storageField) !== null;
    const hasRefereeExplicit =
      refereeField &&
      perf.get(refereeField) !== undefined &&
      perf.get(refereeField) !== null;

    if (hasScoutExplicit || hasRefereeExplicit) {
      return useReferee ? readRefereeOverlapStat(perf, field) : readScoutOverlapStat(perf, field);
    }
    return Number(perf.get(field) || 0);
  }

  return {
    goals: pickOverlap('goals'),
    assists: Number(perf.get('assists') || 0),
    saves: Number(perf.get('saves') || 0),
    yellowCards: pickOverlap('yellowCards'),
    redCards: pickOverlap('redCards'),
    foulsCommitted: pickOverlap('foulsCommitted'),
  };
}

function resolvePerformanceStatsPriority(perf, conflictMap, scopeDefaultPriority) {
  if (scopeDefaultPriority) {
    return normalizeStatsConflictSource(scopeDefaultPriority);
  }
  const pelada = perf.get('pelada');
  const peladaId = pelada && pelada.id ? pelada.id : '';
  if (peladaId && conflictMap.has(peladaId)) {
    return conflictMap.get(peladaId);
  }
  return 'referee';
}

function computeEffectivePerformanceScore(perf, priority) {
  const effective = resolveEffectivePerformanceStats(perf, priority);
  const points = Number(perf.get('points') || 0);
  return (
    points +
    effective.goals * 3 +
    effective.assists * 2 +
    effective.saves * 2 -
    effective.yellowCards -
    effective.redCards * 3
  );
}

function mergeScoutApontamentoStatObjects(base, incoming) {
  const result = { ...base };
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    result[field] = Math.max(Number(base[field] || 0), Number(incoming[field] || 0));
  }
  return result;
}

function buildMergedScoutStatsByParticipantId(performances) {
  const byId = new Map();
  for (const perf of performances) {
    const stats = mapPerformanceToScoutStats(perf);
    const keys = collectPerformanceParticipantKeys(perf);
    for (const key of keys) {
      const existing = byId.get(key);
      byId.set(key, existing ? mergeScoutApontamentoStatObjects(existing, stats) : stats);
    }
  }
  return byId;
}

function mergeRefereeSumulaStatObjects(base, incoming) {
  return {
    goals: Math.max(Number(base.goals || 0), Number(incoming.goals || 0)),
    fouls: Math.max(Number(base.fouls || 0), Number(incoming.fouls || 0)),
    yellowCards: Math.max(Number(base.yellowCards || 0), Number(incoming.yellowCards || 0)),
    redCards: Math.max(Number(base.redCards || 0), Number(incoming.redCards || 0)),
    observation: base.observation || incoming.observation || '',
  };
}

function performanceHasRefereeSumulaData(perf) {
  if (!perf) return false;
  if (perf.get('refereeSumulaSaved')) return true;
  return (
    readRefereeOverlapStat(perf, 'goals') > 0 ||
    readRefereeOverlapStat(perf, 'foulsCommitted') > 0 ||
    readRefereeOverlapStat(perf, 'yellowCards') > 0 ||
    readRefereeOverlapStat(perf, 'redCards') > 0 ||
    Number(perf.get('penaltiesCommitted') || 0) > 0 ||
    Number(perf.get('penaltiesSuffered') || 0) > 0 ||
    !!String(perf.get('refereeObservation') || '').trim()
  );
}

function buildMergedRefereeStatsByParticipantId(performances) {
  const byId = new Map();
  for (const perf of performances) {
    if (!performanceHasRefereeSumulaData(perf)) continue;
    const stats = mapPerformanceToRefereeSumula(perf);
    const keys = collectPerformanceParticipantKeys(perf);
    for (const key of keys) {
      const existing = byId.get(key);
      byId.set(key, existing ? mergeRefereeSumulaStatObjects(existing, stats) : stats);
    }
  }
  return byId;
}

function performanceStatTotal(perf) {
  if (!perf) return 0;
  const stats = mapPerformanceToScoutStats(perf);
  let total = 0;
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals' || SCOUT_GOAL_TYPE_FIELDS.includes(field)) {
      continue;
    }
    total += Number(stats[field] || 0);
  }
  total += Number(stats.goals || 0);
  total += Number(perf.get('saves') || 0);
  return total;
}

function mergePerformanceParseObjects(target, source) {
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    target.set(field, Math.max(Number(target.get(field) || 0), Number(source.get(field) || 0)));
  }
  for (const storageField of Object.values(SCOUT_OVERLAP_STORAGE_FIELDS)) {
    target.set(
      storageField,
      Math.max(Number(target.get(storageField) || 0), Number(source.get(storageField) || 0))
    );
  }
  for (const storageField of Object.values(REFEREE_OVERLAP_STORAGE_FIELDS)) {
    target.set(
      storageField,
      Math.max(Number(target.get(storageField) || 0), Number(source.get(storageField) || 0))
    );
  }
  target.set('saves', Math.max(Number(target.get('saves') || 0), Number(source.get('saves') || 0)));
  target.set('assists', Math.max(Number(target.get('assists') || 0), Number(source.get('assists') || 0)));

  const observation = source.get('refereeObservation');
  if (observation && !target.get('refereeObservation')) {
    target.set('refereeObservation', observation);
  }
}

async function findAllEventPerformancesForParticipant(event, athleteUserId) {
  const matches = new Map();

  const byParticipant = new Parse.Query('EventPerformance');
  byParticipant.equalTo('event', event);
  byParticipant.equalTo('participantUserId', athleteUserId);
  const byParticipantRows = await byParticipant.find({ useMasterKey: true });
  for (const perf of byParticipantRows) {
    matches.set(perf.id, perf);
  }

  if (!String(athleteUserId).startsWith('anon_')) {
    const byUser = new Parse.Query('EventPerformance');
    byUser.equalTo('event', event);
    byUser.equalTo('user', Parse.User.createWithoutData(athleteUserId));
    const byUserRows = await byUser.find({ useMasterKey: true });
    for (const perf of byUserRows) {
      matches.set(perf.id, perf);
    }
  }

  return Array.from(matches.values());
}

function emptyScoutApontamentoStats() {
  const stats = {};
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    stats[field] = 0;
  }
  return stats;
}

function syncScoutGoalsFromTypes(perf) {
  if (!perf || !perf.set) return 0;
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(perf.get(field) || 0);
  }
  perf.set('goals', total);
  perf.set('scoutGoals', total);
  return total;
}

function syncScoutDerivedStats(perf) {
  if (!perf || !perf.set) return;
  const foulsCommitted =
    Number(perf.get('foulsCommittedGame') || 0) + Number(perf.get('foulsCommittedPenalty') || 0);
  const foulsSuffered =
    Number(perf.get('foulsSufferedGame') || 0) + Number(perf.get('foulsSufferedPenalty') || 0);
  perf.set('foulsCommitted', foulsCommitted);
  perf.set('scoutFoulsCommitted', foulsCommitted);
  perf.set('foulsSuffered', foulsSuffered);

  const saves =
    Number(perf.get('savesPenalty') || 0) +
    Number(perf.get('savesFreeKick') || 0) +
    Number(perf.get('savesOpenPlay') || 0);
  perf.set('saves', saves);

  const goalsConceded =
    Number(perf.get('goalsConcededPenalty') || 0) +
    Number(perf.get('goalsConcededFreeKick') || 0) +
    Number(perf.get('goalsConcededOpenPlay') || 0);
  perf.set('goalsConceded', goalsConceded);

  const gkAssists = Number(perf.get('gkAssistsHand') || 0) + Number(perf.get('gkAssistsFeet') || 0);
  if (gkAssists > 0) {
    perf.set('assists', Math.max(Number(perf.get('assists') || 0), gkAssists));
  }
}

/** Soma stats sem contar gols duas vezes (goals ja e a soma dos tipos). */
function accumulateScoutStatsTotals(totals, stats) {
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals' || SCOUT_GOAL_TYPE_FIELDS.includes(field)) {
      continue;
    }
    totals[field] += Number(stats[field] || 0);
  }
  totals.goals += Number(stats.goals || 0);
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    totals[field] += Number(stats[field] || 0);
  }
}

function mapPerformanceToScoutStats(perf) {
  if (!perf) {
    return emptyScoutApontamentoStats();
  }
  const stats = {};
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals') continue;
    if (SCOUT_OVERLAP_STORAGE_FIELDS[field]) {
      stats[field] = readScoutOverlapStat(perf, field);
    } else {
      stats[field] = Number(perf.get(field) || 0);
    }
  }
  stats.goals = sumScoutTypedGoals(stats);
  stats.saves = Number(perf.get('saves') || 0);
  stats.goalsConceded = Number(perf.get('goalsConceded') || 0);
  return stats;
}

function computeScoutGoalsTotalFromPerformance(perf) {
  if (!perf || !perf.get) return 0;
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(perf.get(field) || 0);
  }
  return total;
}

function computeStoredPerformancePoints(perf) {
  const goals = computeScoutGoalsTotalFromPerformance(perf);
  const assists = Number(perf.get('assists') || 0);
  const saves = Number(perf.get('saves') || 0);
  return goals * 3 + assists * 2 + saves * 2;
}

async function assertConfirmedScoutForEvent(user, eventId, allowFinished = false) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const scoutRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'scout')
    .first({ useMasterKey: true });

  if (!scoutRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o scout confirmado neste evento pode registrar apontamento.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(scoutRegistration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o scout confirmado neste evento pode registrar apontamento.'
    );
  }

  if (!allowFinished && event.get('isFinished')) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'O evento ja foi encerrado. Apontamento indisponivel.'
    );
  }

  assertWithinApontamentoWindow(event, 'scoutApontamento', 'Apontamento scout');

  return { event, scoutRegistration };
}

function getPerformanceParticipantId(perf) {
  const explicit = perf.get('participantUserId');
  if (explicit) return String(explicit);
  const user = perf.get('user');
  return user && user.id ? String(user.id) : '';
}

async function findEventPerformanceForParticipant(event, athleteUserId, pelada) {
  const matches = await findAllEventPerformancesForParticipant(event, athleteUserId);

  if (!matches.length) {
    const perf = new Parse.Object('EventPerformance');
    perf.set('event', event);
    perf.set('participantUserId', athleteUserId);
    if (!String(athleteUserId).startsWith('anon_')) {
      perf.set('user', Parse.User.createWithoutData(athleteUserId));
    }
    if (pelada) perf.set('pelada', pelada);
    perf.set('role', 'athlete');
    return perf;
  }

  if (matches.length === 1) {
    const perf = matches[0];
    if (!perf.get('participantUserId')) {
      perf.set('participantUserId', athleteUserId);
    }
    if (!perf.get('user') && !String(athleteUserId).startsWith('anon_')) {
      perf.set('user', Parse.User.createWithoutData(athleteUserId));
    }
    if (pelada && !perf.get('pelada')) {
      perf.set('pelada', pelada);
    }
    return perf;
  }

  matches.sort((a, b) => performanceStatTotal(b) - performanceStatTotal(a));
  const canonical = matches[0];
  const duplicates = matches.slice(1);
  for (const duplicate of duplicates) {
    mergePerformanceParseObjects(canonical, duplicate);
  }
  if (!canonical.get('participantUserId')) {
    canonical.set('participantUserId', athleteUserId);
  }
  if (!canonical.get('user') && !String(athleteUserId).startsWith('anon_')) {
    canonical.set('user', Parse.User.createWithoutData(athleteUserId));
  }
  if (pelada && !canonical.get('pelada')) {
    canonical.set('pelada', pelada);
  }
  await saveEventPerformance(canonical);
  for (const duplicate of duplicates) {
    await duplicate.destroy({ useMasterKey: true });
  }
  return canonical;
}

async function assertScoutAthleteAssignment(scoutRegistration, event, athleteUserId) {
  const assigned = scoutRegistration.get('scoutAssignedAthleteUserId');
  if (!assigned) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Selecione um atleta antes de registrar apontamento.'
    );
  }
  if (String(assigned) !== String(athleteUserId)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce so pode apontar o atleta atribuido a voce neste evento.'
    );
  }

  const conflictQuery = new Parse.Query('EventRegistration');
  conflictQuery.equalTo('event', event);
  conflictQuery.equalTo('role', 'scout');
  conflictQuery.equalTo('scoutAssignedAthleteUserId', athleteUserId);
  conflictQuery.notEqualTo('objectId', scoutRegistration.id);
  const conflict = await conflictQuery.first({ useMasterKey: true });
  if (conflict) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Outro scout ja esta apontando este atleta neste evento.'
    );
  }
}

async function assertConfirmedAthleteInEvent(event, athleteUserId) {
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .limit(500)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId !== athleteUserId) continue;
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Atleta ainda nao confirmado neste evento.'
      );
    }
    return registration;
  }

  throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Atleta nao encontrado neste evento.');
}

async function assertCanAccessScoutApontamento(user, eventId) {
  try {
    const result = await assertConfirmedScoutForEvent(user, eventId, true);
    return { ...result, viewOnly: false };
  } catch (scoutError) {
    const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
    const participationFee = Number(event.get('participationFee') || 0);

    const registration = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .equalTo('user', user)
      .first({ useMasterKey: true });

    if (!registration || !computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      throw scoutError;
    }

    const savedPerf = await new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .equalTo('scoutApontamentoSaved', true)
      .first({ useMasterKey: true });

    if (!savedPerf) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'Apontamento scout ainda nao disponivel para consulta.'
      );
    }

    return { event, scoutRegistration: null, viewOnly: true };
  }
}

Parse.Cloud.define('eventHasScoutApontamento', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const savedPerf = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .equalTo('scoutApontamentoSaved', true)
    .first({ useMasterKey: true });

  return { hasScoutApontamento: !!savedPerf };
});

Parse.Cloud.define('getScoutApontamentoBoard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const { event, scoutRegistration, viewOnly } = await assertCanAccessScoutApontamento(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);
  const locked = !!event.get('isFinished') || viewOnly;
  const assignedAthleteUserId =
    !viewOnly && scoutRegistration && scoutRegistration.get('scoutAssignedAthleteUserId')
      ? String(scoutRegistration.get('scoutAssignedAthleteUserId'))
      : '';

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .ascending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });

  const perfStatsByParticipantId = buildMergedScoutStatsByParticipantId(performances);

  const assignedScouts = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'scout')
    .exists('scoutAssignedAthleteUserId')
    .limit(200)
    .find({ useMasterKey: true });
  const assignedAthleteIds = new Set(
    assignedScouts
      .map((row) => row.get('scoutAssignedAthleteUserId'))
      .filter(Boolean)
      .map((value) => String(value))
  );

  const athletes = [];
  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;

    const row = mapRegistrationForEventListItem(registration, eventId, participationFee);
    const stats =
      perfStatsByParticipantId.get(resolved.userId) || emptyScoutApontamentoStats();

    athletes.push({
      userId: resolved.userId,
      registrationId: registration.id,
      apelido: row.apelido || row.userName,
      userName: row.userName,
      avatarUrl: row.avatarUrl || undefined,
      primaryPosition: row.primaryPosition || undefined,
      isAssignedToAnotherScout:
        assignedAthleteIds.has(resolved.userId) && resolved.userId !== assignedAthleteUserId,
      stats,
    });
  }

  athletes.sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));

  const boardAthletes = viewOnly
    ? athletes
    : assignedAthleteUserId
      ? athletes.filter((athlete) => athlete.userId === assignedAthleteUserId)
      : athletes.filter((athlete) => !athlete.isAssignedToAnotherScout);

  return {
    eventId,
    eventName: event.get('name') || 'Evento',
    locked,
    viewOnly,
    assignedAthleteUserId: assignedAthleteUserId || undefined,
    canAssign: !locked && !assignedAthleteUserId && !viewOnly,
    athletes: boardAthletes,
    allAthletes: athletes,
    selectableAthletes: viewOnly || assignedAthleteUserId
      ? []
      : athletes.filter((athlete) => !athlete.isAssignedToAnotherScout),
  };
});

Parse.Cloud.define('assignScoutApontamentoAthlete', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  if (!eventId || !athleteUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId e athleteUserId sao obrigatorios.'
    );
  }

  const { event, scoutRegistration } = await assertConfirmedScoutForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  const existingAssignment = scoutRegistration.get('scoutAssignedAthleteUserId');
  if (existingAssignment && String(existingAssignment) !== athleteUserId) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Voce ja esta apontando outro atleta neste evento.'
    );
  }

  const conflictQuery = new Parse.Query('EventRegistration');
  conflictQuery.equalTo('event', event);
  conflictQuery.equalTo('role', 'scout');
  conflictQuery.equalTo('scoutAssignedAthleteUserId', athleteUserId);
  conflictQuery.notEqualTo('objectId', scoutRegistration.id);
  const conflict = await conflictQuery.first({ useMasterKey: true });
  if (conflict) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Outro scout ja esta apontando este atleta neste evento.'
    );
  }

  scoutRegistration.set('scoutAssignedAthleteUserId', athleteUserId);
  await scoutRegistration.save(null, { useMasterKey: true });

  return { ok: true, athleteUserId };
});

Parse.Cloud.define('incrementScoutApontamento', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  const field = request.params.field ? String(request.params.field) : '';
  const delta = Number(request.params.delta);

  if (!eventId || !athleteUserId || !field) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, athleteUserId e field sao obrigatorios.'
    );
  }

  if (!SCOUT_APONTAMENTO_FIELDS.includes(field)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Campo de apontamento invalido.');
  }

  if (field === 'goals') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Gol a favor e calculado automaticamente pelos tipos de gol.'
    );
  }

  if (SCOUT_DERIVED_TOTAL_FIELDS.includes(field)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este total e calculado automaticamente pelos subitens.'
    );
  }

  if (delta !== 1 && delta !== -1) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'delta deve ser 1 ou -1.');
  }

  const { event, scoutRegistration } = await assertConfirmedScoutForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  // Exclusividade: nao editar atleta ja atribuido a OUTRO scout.
  // Quem tem atleta individual ainda pode usar o modo Geral nos demais livres.
  const exclusiveOwnerQuery = new Parse.Query('EventRegistration');
  exclusiveOwnerQuery.equalTo('event', event);
  exclusiveOwnerQuery.equalTo('role', 'scout');
  exclusiveOwnerQuery.equalTo('scoutAssignedAthleteUserId', athleteUserId);
  exclusiveOwnerQuery.notEqualTo('objectId', scoutRegistration.id);
  const exclusiveOwner = await exclusiveOwnerQuery.first({ useMasterKey: true });
  if (exclusiveOwner) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Outro scout ja esta apontando este atleta neste evento.'
    );
  }

  const pelada = event.get('pelada');
  let perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);

  const storageField = SCOUT_OVERLAP_STORAGE_FIELDS[field] || field;
  let current = Number(perf.get(storageField));
  if (perf.get(storageField) === undefined) {
    current = SCOUT_OVERLAP_STORAGE_FIELDS[field]
      ? readScoutOverlapStat(perf, field)
      : Number(perf.get(field) || 0);
  }
  const next = Math.max(0, current + delta);
  perf.set(storageField, next);
  if (SCOUT_OVERLAP_STORAGE_FIELDS[field]) {
    perf.set(field, next);
  }
  if (SCOUT_GOAL_TYPE_FIELDS.includes(field)) {
    syncScoutGoalsFromTypes(perf);
  }
  syncScoutDerivedStats(perf);
  perf.set('points', computeStoredPerformancePoints(perf));
  perf.set('scoutApontamentoSaved', true);
  await saveEventPerformance(perf);

  return {
    ok: true,
    athleteUserId,
    stats: mapPerformanceToScoutStats(perf),
  };
});

async function loadFinishedEventsForPredictionScope(scope, scopeId) {
  if (scope === 'event' && scopeId) {
    const event = await new Parse.Query('Event').get(scopeId, { useMasterKey: true });
    const ended =
      !!event.get('isFinished') ||
      (event.get('endTime') instanceof Date && event.get('endTime') < new Date());
    return ended ? [event] : [];
  }

  const peladaFilter = scope === 'pelada' && scopeId
    ? Parse.Object.extend('Pelada').createWithoutData(scopeId)
    : null;
  const byId = new Map();

  const finishedQuery = new Parse.Query('Event');
  finishedQuery.equalTo('isFinished', true);
  if (peladaFilter) {
    finishedQuery.equalTo('pelada', peladaFilter);
  }
  finishedQuery.limit(500);
  for (const event of await finishedQuery.find({ useMasterKey: true })) {
    byId.set(event.id, event);
  }

  const endedQuery = new Parse.Query('Event');
  endedQuery.notEqualTo('isFinished', true);
  endedQuery.lessThan('endTime', new Date());
  if (peladaFilter) {
    endedQuery.equalTo('pelada', peladaFilter);
  }
  endedQuery.limit(500);
  for (const event of await endedQuery.find({ useMasterKey: true })) {
    byId.set(event.id, event);
  }

  return Array.from(byId.values());
}

async function buildEventActualPredictionResults(event) {
  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });

  if (!performances.length) {
    return { ready: false };
  }

  const statsByUser = new Map();
  for (const perf of performances) {
    const participantId = getPerformanceParticipantId(perf);
    if (!participantId) continue;
    const stats = mapPerformanceToScoutStats(perf);
    const refereeStats = mapPerformanceToRefereeSumula(perf);
    const mergedGoals = Math.max(
      Number(stats.goals || 0),
      Number(refereeStats.goals || 0),
      Number(perf.get('goals') || 0)
    );
    const mergedYellow = Math.max(
      Number(stats.yellowCards || 0),
      Number(refereeStats.yellowCards || 0)
    );
    const mergedRed = Math.max(Number(stats.redCards || 0), Number(refereeStats.redCards || 0));
    const existing = statsByUser.get(participantId);
    const next = {
      goals: mergedGoals,
      saves: Math.max(Number(stats.saves || 0), Number(existing?.saves || 0)),
      yellowCards: mergedYellow,
      redCards: mergedRed,
      role: perf.get('role') || 'athlete',
    };
    if (existing) {
      next.goals = Math.max(existing.goals, next.goals);
      next.yellowCards = Math.max(existing.yellowCards, next.yellowCards);
      next.redCards = Math.max(existing.redCards, next.redCards);
      next.saves = Math.max(existing.saves, next.saves);
    }
    statsByUser.set(participantId, next);
  }

  let hasMeaningfulStats = false;
  for (const stats of statsByUser.values()) {
    if (stats.goals || stats.saves || stats.yellowCards || stats.redCards) {
      hasMeaningfulStats = true;
      break;
    }
  }
  if (!hasMeaningfulStats) {
    return { ready: false };
  }

  let topScorerUserId = null;
  let maxGoals = -1;
  for (const [participantId, stats] of statsByUser.entries()) {
    if (stats.role !== 'goalkeeper' && stats.goals > maxGoals) {
      maxGoals = stats.goals;
      topScorerUserId = participantId;
    }
  }

  let leastConcededKeeperUserId = null;
  let maxSaves = -1;
  for (const [participantId, stats] of statsByUser.entries()) {
    if (stats.role === 'goalkeeper' && stats.saves > maxSaves) {
      maxSaves = stats.saves;
      leastConcededKeeperUserId = participantId;
    }
  }

  const goalScorers = {};
  const yellowCardUserIds = [];
  const redCardUserIds = [];
  for (const [participantId, stats] of statsByUser.entries()) {
    if (stats.goals > 0) {
      goalScorers[participantId] = stats.goals;
    }
    if (stats.yellowCards > 0) {
      yellowCardUserIds.push(participantId);
    }
    if (stats.redCards > 0) {
      redCardUserIds.push(participantId);
    }
  }

  let homeScore = 0;
  let awayScore = 0;
  if (event.get('type') === 'team_match') {
    const participationFee = Number(event.get('participationFee') || 0);
    const athleteRegs = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .equalTo('role', 'athlete')
      .ascending('arrivalOrder')
      .addAscending('apelido')
      .limit(500)
      .find({ useMasterKey: true });

    const confirmedAthletes = [];
    for (const registration of athleteRegs) {
      const resolved = await resolveRegistrationParticipantUserId(registration);
      if (!resolved.userId) continue;
      if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
      confirmedAthletes.push(resolved.userId);
    }

    const midpoint = Math.ceil(confirmedAthletes.length / 2);
    const homeIds = new Set(confirmedAthletes.slice(0, midpoint));
    for (const [participantId, stats] of statsByUser.entries()) {
      if (homeIds.has(participantId)) {
        homeScore += stats.goals;
      } else {
        awayScore += stats.goals;
      }
    }
  }

  return {
    ready: true,
    topScorerUserId,
    leastConcededKeeperUserId,
    homeScore,
    awayScore,
    goalScorers,
    yellowCardUserIds,
    redCardUserIds,
  };
}

function scoreFanPredictionRecord(prediction, actual, eventType) {
  let score = 0;

  if (
    actual.topScorerUserId &&
    String(prediction.get('topScorerUserId') || '') === String(actual.topScorerUserId)
  ) {
    score += 3;
  }

  if (
    actual.leastConcededKeeperUserId &&
    String(prediction.get('leastConcededKeeperUserId') || '') ===
      String(actual.leastConcededKeeperUserId)
  ) {
    score += 3;
  }

  if (eventType === 'team_match') {
    const predictedHome = prediction.get('homeScore');
    const predictedAway = prediction.get('awayScore');
    const homeExact = predictedHome != null && Number(predictedHome) === Number(actual.homeScore);
    const awayExact = predictedAway != null && Number(predictedAway) === Number(actual.awayScore);
    if (homeExact) score += 2;
    if (awayExact) score += 2;
    if (homeExact && awayExact) score += 1;
  }

  const predictedScorers = prediction.get('goalScorers') || [];
  for (const row of predictedScorers) {
    const userId = row && row.userId ? String(row.userId) : '';
    const goals = row && row.goals != null ? Number(row.goals) : 0;
    if (!userId) continue;
    if (actual.goalScorers[userId] != null && Number(actual.goalScorers[userId]) === goals) {
      score += 1;
    }
  }

  const predictedYellow = new Set((prediction.get('yellowCardUserIds') || []).map(String));
  for (const userId of actual.yellowCardUserIds) {
    if (predictedYellow.has(String(userId))) score += 1;
  }

  const predictedRed = new Set((prediction.get('expelledUserIds') || []).map(String));
  for (const userId of actual.redCardUserIds) {
    if (predictedRed.has(String(userId))) score += 2;
  }

  return score;
}

async function enrichPredictionRankingEntries(entries) {
  const enriched = [];
  for (const entry of entries) {
    let userName = entry.userName || 'Participante';
    let avatarUrl = entry.avatarUrl;
    try {
      const user = await new Parse.Query(Parse.User).get(entry.userId, { useMasterKey: true });
      userName =
        user.get('apelido') ||
        user.get('name') ||
        user.getUsername() ||
        userName;
      avatarUrl = user.get('avatarUrl') || avatarUrl;
    } catch {
      // mantem fallback
    }
    enriched.push({
      userId: entry.userId,
      userName,
      avatarUrl: avatarUrl || undefined,
      totalScore: entry.totalScore,
      eventsCount: entry.eventsCount,
    });
  }
  return enriched;
}

Parse.Cloud.define('getPredictionRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const limit = Math.min(Number(request.params.limit) || 10, 50);

  const events = await loadFinishedEventsForPredictionScope(scope, scopeId);
  if (!events.length) {
    return { entries: [] };
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

  return { entries: await enrichPredictionRankingEntries(entries) };
});

Parse.Cloud.define('getAthleteScoutPerformanceSummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const athleteUserId = request.params.athleteUserId
    ? String(request.params.athleteUserId)
    : String(request.user.id);

  const byUser = new Parse.Query('EventPerformance');
  byUser.equalTo('user', Parse.User.createWithoutData(athleteUserId));
  const byParticipant = new Parse.Query('EventPerformance');
  byParticipant.equalTo('participantUserId', athleteUserId);
  const performances = await Parse.Query.or(byUser, byParticipant)
    .include('event')
    .descending('updatedAt')
    .limit(200)
    .find({ useMasterKey: true });

  const totals = emptyScoutApontamentoStats();
  const events = [];

  for (const perf of performances) {
    const stats = mapPerformanceToScoutStats(perf);
    accumulateScoutStatsTotals(totals, stats);

    const event = perf.get('event');
    if (!event) continue;
    events.push({
      eventId: event.id,
      eventName: event.get('name') || 'Evento',
      eventDate: event.get('startTime') ? event.get('startTime').toISOString() : undefined,
      stats,
    });
  }

  return {
    athleteUserId,
    totals,
    events,
  };
});

const REFEREE_SUMULA_FIELDS = [
  'goals',
  'foulsCommitted',
  'yellowCards',
  'redCards',
  'penaltiesCommitted',
  'penaltiesSuffered',
];

function emptyRefereeSumulaStats() {
  return {
    goals: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    penaltiesCommitted: 0,
    penaltiesSuffered: 0,
    observation: '',
  };
}

function mapPerformanceToRefereeSumula(perf) {
  if (!perf) {
    return emptyRefereeSumulaStats();
  }
  return {
    goals: readRefereeOverlapStat(perf, 'goals'),
    fouls: readRefereeOverlapStat(perf, 'foulsCommitted'),
    yellowCards: readRefereeOverlapStat(perf, 'yellowCards'),
    redCards: readRefereeOverlapStat(perf, 'redCards'),
    penaltiesCommitted: Number(perf.get('penaltiesCommitted') || 0),
    penaltiesSuffered: Number(perf.get('penaltiesSuffered') || 0),
    observation: perf.get('refereeObservation') ? String(perf.get('refereeObservation')) : '',
  };
}

async function assertCanViewRefereeSumula(user, eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);
  const eventEnded = isEventEndedForTools(event);
  const withinSumulaWindow = isWithinApontamentoWindow(event, 'sumula');
  const locked = eventEnded;

  const eventAdmin = event.get('admin');
  if (eventAdmin && eventAdmin.id === user.id) {
    return { event, locked, canEdit: false };
  }

  const pelada = event.get('pelada');
  if (pelada && pelada.id) {
    const peladaObj = await new Parse.Query('Pelada').get(pelada.id, { useMasterKey: true });
    const peladaAdmin = peladaObj.get('admin');
    if (peladaAdmin && peladaAdmin.id === user.id) {
      return { event, locked, canEdit: false };
    }
  }

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (!registration || !computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao tem permissao para consultar a sumula deste evento.'
    );
  }

  const isReferee = registration.get('role') === 'referee';
  if (!eventEnded && !isReferee) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'A sumula fica disponivel para consulta apos o encerramento do evento.'
    );
  }

  const canEdit = isReferee && !eventEnded && withinSumulaWindow;

  return { event, locked, canEdit };
}

async function assertConfirmedRefereeForEvent(user, eventId, allowFinished = false) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const refereeRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'referee')
    .first({ useMasterKey: true });

  if (!refereeRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o juiz confirmado neste evento pode registrar a sumula.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(refereeRegistration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o juiz confirmado neste evento pode registrar a sumula.'
    );
  }

  if (!allowFinished && isEventEndedForTools(event)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'O evento ja foi encerrado. Sumula indisponivel.'
    );
  }

  assertWithinApontamentoWindow(event, 'sumula', 'Sumula');

  return { event, refereeRegistration };
}

Parse.Cloud.define('getRefereeSumulaBoard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const { event, locked, canEdit } = await assertCanViewRefereeSumula(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .ascending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });

  const eventPerformances = performances.filter((perf) => {
    const perfEvent = perf.get('event');
    return perfEvent && String(perfEvent.id) === String(event.id);
  });

  const perfStatsByParticipantId = buildMergedRefereeStatsByParticipantId(eventPerformances);

  const athletes = [];
  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;

    const row = mapRegistrationForEventListItem(registration, eventId, participationFee);
    const stats =
      perfStatsByParticipantId.get(resolved.userId) || emptyRefereeSumulaStats();

    athletes.push({
      userId: resolved.userId,
      registrationId: registration.id,
      apelido: row.apelido || row.userName,
      userName: row.userName,
      avatarUrl: row.avatarUrl || undefined,
      primaryPosition: row.primaryPosition || undefined,
      stats,
    });
  }

  athletes.sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));

  return {
    eventId,
    eventName: event.get('name') || 'Evento',
    locked,
    canEdit,
    athletes,
  };
});

Parse.Cloud.define('incrementRefereeSumula', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  const field = request.params.field ? String(request.params.field) : '';
  const delta = Number(request.params.delta);

  if (!eventId || !athleteUserId || !field) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, athleteUserId e field sao obrigatorios.'
    );
  }

  if (!REFEREE_SUMULA_FIELDS.includes(field)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Campo de sumula invalido.');
  }

  if (delta !== 1 && delta !== -1) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'delta deve ser 1 ou -1.');
  }

  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  const pelada = event.get('pelada');
  let perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);

  const storageField = REFEREE_OVERLAP_STORAGE_FIELDS[field];
  if (!storageField) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Campo de sumula invalido.');
  }
  const current = Number(perf.get(storageField) || 0);
  const next = Math.max(0, current + delta);
  perf.set(storageField, next);
  perf.set('points', computeStoredPerformancePoints(perf));
  perf.set('refereeSumulaSaved', true);
  await saveEventPerformance(perf);

  return {
    ok: true,
    athleteUserId,
    stats: mapPerformanceToRefereeSumula(perf),
  };
});

function applyRefereeSumulaStatsToPerformance(perf, stats) {
  perf.set('refereeGoals', Math.max(0, Number(stats.goals || 0)));
  perf.set('refereeFoulsCommitted', Math.max(0, Number(stats.fouls || 0)));
  perf.set('refereeYellowCards', Math.max(0, Number(stats.yellowCards || 0)));
  perf.set('refereeRedCards', Math.max(0, Number(stats.redCards || 0)));
  perf.set('penaltiesCommitted', Math.max(0, Number(stats.penaltiesCommitted || 0)));
  perf.set('penaltiesSuffered', Math.max(0, Number(stats.penaltiesSuffered || 0)));
  if (stats.observation != null) {
    perf.set('refereeObservation', String(stats.observation || '').trim());
  }
  perf.set('refereeSumulaSaved', true);
  perf.set('points', computeStoredPerformancePoints(perf));
}

Parse.Cloud.define('saveRefereeSumulaBoard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const entries = Array.isArray(request.params.entries) ? request.params.entries : [];

  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  const pelada = event.get('pelada');

  for (const entry of entries) {
    const athleteUserId = entry && entry.athleteUserId ? String(entry.athleteUserId) : '';
    if (!athleteUserId) continue;

    await assertConfirmedAthleteInEvent(event, athleteUserId);
    const stats = entry.stats || {};
    const perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);
    applyRefereeSumulaStatsToPerformance(perf, stats);
    await saveEventPerformance(perf);
  }

  return { ok: true, saved: entries.length };
});

Parse.Cloud.define('saveRefereeSumulaObservation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  const observation =
    request.params.observation != null ? String(request.params.observation).trim() : '';

  if (!eventId || !athleteUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId e athleteUserId sao obrigatorios.'
    );
  }

  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  const pelada = event.get('pelada');
  const perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);
  perf.set('refereeObservation', observation);
  perf.set('refereeSumulaSaved', true);
  await saveEventPerformance(perf);

  return {
    ok: true,
    athleteUserId,
    stats: mapPerformanceToRefereeSumula(perf),
  };
});

async function registerPenaltyForEvent(event, pelada, committedUserId, sufferedUserId) {
  const committedPerf = await findEventPerformanceForParticipant(event, committedUserId, pelada);
  const sufferedPerf = await findEventPerformanceForParticipant(event, sufferedUserId, pelada);
  committedPerf.set(
    'penaltiesCommitted',
    Math.max(0, Number(committedPerf.get('penaltiesCommitted') || 0) + 1)
  );
  sufferedPerf.set(
    'penaltiesSuffered',
    Math.max(0, Number(sufferedPerf.get('penaltiesSuffered') || 0) + 1)
  );
  await saveEventPerformance(committedPerf);
  await saveEventPerformance(sufferedPerf);
  return {
    committedUserId,
    sufferedUserId,
    committedStats: mapPerformanceToScoutStats(committedPerf),
    sufferedStats: mapPerformanceToScoutStats(sufferedPerf),
  };
}

Parse.Cloud.define('registerScoutPenalty', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const committedUserId = request.params.committedUserId ? String(request.params.committedUserId) : '';
  const sufferedUserId = request.params.sufferedUserId ? String(request.params.sufferedUserId) : '';
  if (!eventId || !committedUserId || !sufferedUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, committedUserId e sufferedUserId sao obrigatorios.'
    );
  }
  if (committedUserId === sufferedUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione atletas diferentes.');
  }
  const { event } = await assertConfirmedScoutForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, committedUserId);
  await assertConfirmedAthleteInEvent(event, sufferedUserId);
  const pelada = event.get('pelada');
  return registerPenaltyForEvent(event, pelada, committedUserId, sufferedUserId);
});

Parse.Cloud.define('registerRefereePenalty', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const committedUserId = request.params.committedUserId ? String(request.params.committedUserId) : '';
  const sufferedUserId = request.params.sufferedUserId ? String(request.params.sufferedUserId) : '';
  if (!eventId || !committedUserId || !sufferedUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, committedUserId e sufferedUserId sao obrigatorios.'
    );
  }
  if (committedUserId === sufferedUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione atletas diferentes.');
  }
  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, committedUserId);
  await assertConfirmedAthleteInEvent(event, sufferedUserId);
  const pelada = event.get('pelada');
  return registerPenaltyForEvent(event, pelada, committedUserId, sufferedUserId);
});

function aggregatePerformanceStatsFromRows(performances, priority) {
  const totals = emptyScoutApontamentoStats();
  for (const perf of performances) {
    const row = mapPerformanceToScoutStats(perf);
    if (priority === 'referee') {
      row.goals = readRefereeOverlapStat(perf, 'goals') || row.goals;
      row.foulsCommitted = readRefereeOverlapStat(perf, 'foulsCommitted') || row.foulsCommitted;
      row.yellowCards = readRefereeOverlapStat(perf, 'yellowCards') || row.yellowCards;
      row.redCards = readRefereeOverlapStat(perf, 'redCards') || row.redCards;
    }
    accumulateScoutStatsTotals(totals, row);
  }
  return totals;
}

Parse.Cloud.define('getAthletePerformanceDashboard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : '';
  const athleteUserId = request.params.athleteUserId
    ? String(request.params.athleteUserId)
    : user.id;

  let performances = [];
  if (scope === 'event' && scopeId) {
    const event = await new Parse.Query('Event').get(scopeId, { useMasterKey: true });
    performances = await new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .equalTo('participantUserId', athleteUserId)
      .find({ useMasterKey: true });
  } else if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    performances = await new Parse.Query('EventPerformance')
      .equalTo('pelada', pelada)
      .equalTo('participantUserId', athleteUserId)
      .limit(500)
      .find({ useMasterKey: true });
  } else {
    performances = await new Parse.Query('EventPerformance')
      .equalTo('participantUserId', athleteUserId)
      .limit(500)
      .find({ useMasterKey: true });
  }

  const totals = aggregatePerformanceStatsFromRows(performances, 'scout');
  const totalShots = totals.shotsOffTarget + totals.shotsOnTarget;
  const totalPasses = totals.passesCompleted + totals.passesMissed;

  return {
    athleteUserId,
    scope,
    scopeId: scopeId || undefined,
    totals,
    charts: {
      shotsOnTarget: totals.shotsOnTarget,
      shotsOffTarget: totals.shotsOffTarget,
      goals: totals.goals,
      shotAccuracyPct: totalShots ? Math.round((totals.shotsOnTarget / totalShots) * 100) : 0,
      goalConversionPct: totals.shotsOnTarget
        ? Math.round((totals.goals / totals.shotsOnTarget) * 100)
        : 0,
      passAccuracyPct: totalPasses ? Math.round((totals.passesCompleted / totalPasses) * 100) : 0,
      foulsCommitted: totals.foulsCommitted,
      foulsSuffered: totals.foulsSuffered,
      assists: totals.assists,
    },
  };
});

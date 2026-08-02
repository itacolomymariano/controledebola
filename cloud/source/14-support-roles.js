/** Ferramentas de dia de evento: torcedor, treinador, preparador fisico, massagista */

const FAN_CHECKIN_CLASS = 'FanEventCheckIn';
const COACH_BOARD_CLASS = 'CoachEventBoard';
const MASSEUR_TREATMENT_CLASS = 'MasseurTreatment';
const TRAINER_SESSION_CLASS = 'PhysicalTrainerSession';

const SUPPORT_ROLES = ['fan', 'coach', 'physical_trainer', 'masseur'];

const MASSEUR_PHASES = ['pre', 'halftime', 'post'];
const MASSEUR_RETURN_STATUSES = ['cleared', 'limited', 'out'];
const TRAINER_FOCUSES = ['endurance', 'explosion', 'mobility', 'recovery', 'general'];

function trimSupportText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function normalizeAttendanceMode(value) {
  const mode = String(value || '').trim();
  return mode === 'remote' ? 'remote' : 'presential';
}

async function loadSupportEvent(eventId) {
  const id = String(eventId || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  return new Parse.Query('Event').get(id, { useMasterKey: true });
}

async function loadSupportRegistration(user, event) {
  return new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
}

async function assertConfirmedSupportRole(user, eventId, role) {
  const event = await loadSupportEvent(eventId);
  const registration = await loadSupportRegistration(user, event);
  if (!registration) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Inscricao no evento obrigatoria.');
  }
  if (registration.get('role') !== role) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Perfil sem permissao para esta acao.');
  }
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Participacao ainda nao confirmada.');
  }
  return { event, registration };
}

async function assertEventAdminOrSupportRole(user, eventId, role) {
  try {
    const event = await assertEventAdmin(user, eventId);
    return { event, registration: null, isAdmin: true };
  } catch {
    // segue para papel confirmado
  }
  const { event, registration } = await assertConfirmedSupportRole(user, eventId, role);
  return { event, registration, isAdmin: false };
}

function mapFanCheckIn(obj, user) {
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    userId: user ? user.id : obj.get('user') && obj.get('user').id ? obj.get('user').id : undefined,
    userName:
      (user && (user.get('apelido') || user.get('name') || user.getUsername())) ||
      obj.get('userName') ||
      'Torcedor',
    avatarUrl: user ? resolveStoredAvatarUrl(user, null) : obj.get('avatarUrl') || undefined,
    attendanceMode: normalizeAttendanceMode(obj.get('attendanceMode')),
    message: obj.get('message') || '',
    checkedInAt: obj.get('checkedInAt')
      ? obj.get('checkedInAt').toISOString()
      : obj.createdAt
        ? obj.createdAt.toISOString()
        : undefined,
  };
}

function mapCoachBoard(obj) {
  const checklist = obj.get('checklist') || {};
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    coachUserId: obj.get('coachUser') && obj.get('coachUser').id ? obj.get('coachUser').id : undefined,
    checklist: {
      talkedToTeam: !!checklist.talkedToTeam,
      ledWarmup: !!checklist.ledWarmup,
      lineupDefined: !!checklist.lineupDefined,
    },
    teamNotes: Array.isArray(obj.get('teamNotes')) ? obj.get('teamNotes') : [],
    suggestedStarters: Array.isArray(obj.get('suggestedStarters'))
      ? obj.get('suggestedStarters')
      : [],
    rotationNotes: obj.get('rotationNotes') || '',
    updatedAt: obj.updatedAt ? obj.updatedAt.toISOString() : undefined,
  };
}

function mapMasseurTreatment(obj) {
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    masseurUserId:
      obj.get('masseurUser') && obj.get('masseurUser').id ? obj.get('masseurUser').id : undefined,
    athleteUserId:
      obj.get('athleteUser') && obj.get('athleteUser').id ? obj.get('athleteUser').id : undefined,
    athleteName: obj.get('athleteName') || 'Atleta',
    phase: obj.get('phase') || 'pre',
    bodyRegion: obj.get('bodyRegion') || '',
    treatmentType: obj.get('treatmentType') || '',
    durationMin: Math.max(0, Number(obj.get('durationMin') || 0)),
    returnStatus: obj.get('returnStatus') || 'cleared',
    notes: obj.get('notes') || '',
    createdAt: obj.createdAt ? obj.createdAt.toISOString() : undefined,
  };
}

function mapTrainerSession(obj) {
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    trainerUserId:
      obj.get('trainerUser') && obj.get('trainerUser').id ? obj.get('trainerUser').id : undefined,
    planFocus: obj.get('planFocus') || 'general',
    planDurationMin: Math.max(0, Number(obj.get('planDurationMin') || 0)),
    planNotes: obj.get('planNotes') || '',
    warmupStartedAt: obj.get('warmupStartedAt')
      ? obj.get('warmupStartedAt').toISOString()
      : undefined,
    warmupEndedAt: obj.get('warmupEndedAt') ? obj.get('warmupEndedAt').toISOString() : undefined,
    cooldownDone: !!obj.get('cooldownDone'),
    athleteUserIds: Array.isArray(obj.get('athleteUserIds')) ? obj.get('athleteUserIds') : [],
    updatedAt: obj.updatedAt ? obj.updatedAt.toISOString() : undefined,
  };
}

async function countConfirmedRoleEvents(userId, role) {
  const userPtr = Parse.User.createWithoutData(userId);
  const regs = await new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .equalTo('role', role)
    .limit(500)
    .find({ useMasterKey: true });
  let confirmed = 0;
  for (const reg of regs) {
    const event = reg.get('event');
    if (!event) continue;
    try {
      await event.fetch({ useMasterKey: true });
    } catch {
      continue;
    }
    const fee = Number(event.get('participationFee') || 0);
    if (computeRegistrationEffectiveConfirmation(reg, fee)) confirmed += 1;
  }
  return { eventsCount: confirmed, registrationsCount: regs.length };
}

// --- Torcedor ---

Parse.Cloud.define('submitFanCheckIn', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, registration } = await assertConfirmedSupportRole(request.user, eventId, 'fan');
  const attendanceMode = normalizeAttendanceMode(
    request.params.attendanceMode || registration.get('attendanceMode')
  );
  const message = trimSupportText(request.params.message, 160);

  let row = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .equalTo('user', request.user)
    .first({ useMasterKey: true });
  if (!row) {
    row = new Parse.Object(FAN_CHECKIN_CLASS);
    row.set('event', event);
    row.set('user', request.user);
  }
  row.set('attendanceMode', attendanceMode);
  row.set('message', message);
  row.set('userName', request.user.get('apelido') || request.user.get('name') || request.user.getUsername());
  row.set('avatarUrl', resolveStoredAvatarUrl(request.user, registration) || undefined);
  row.set('checkedInAt', new Date());
  await row.save(null, { useMasterKey: true });
  return mapFanCheckIn(row, request.user);
});

Parse.Cloud.define('getEventFanCheckIns', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  await assertEventAdminOrSupportRole(request.user, eventId, 'fan');
  const event = await loadSupportEvent(eventId);
  const rows = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .descending('checkedInAt')
    .limit(200)
    .find({ useMasterKey: true });
  return rows.map((row) => mapFanCheckIn(row, null));
});

Parse.Cloud.define('getMyFanCheckIn', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const event = await loadSupportEvent(eventId);
  const row = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .equalTo('user', request.user)
    .first({ useMasterKey: true });
  return row ? mapFanCheckIn(row, request.user) : null;
});

Parse.Cloud.define('getFanHighlightRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const scope = String(request.params.scope || 'app').trim();
  const scopeId = String(request.params.scopeId || '').trim();
  const limit = Math.min(Math.max(Number(request.params.limit) || 10, 1), 50);

  let eventIds = null;
  if (scope === 'event') {
    if (!scopeId) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'scopeId obrigatorio.');
    }
    eventIds = [scopeId];
  } else if (scope === 'pelada') {
    if (!scopeId) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'scopeId obrigatorio.');
    }
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .select(['objectId'])
      .limit(500)
      .find({ useMasterKey: true });
    eventIds = events.map((e) => e.id);
  }

  const query = new Parse.Query(FAN_CHECKIN_CLASS).limit(1000);
  if (eventIds) {
    if (!eventIds.length) return [];
    const eventPtrs = eventIds.map((id) => Parse.Object.extend('Event').createWithoutData(id));
    query.containedIn('event', eventPtrs);
  }
  const rows = await query.find({ useMasterKey: true });
  const byUser = new Map();
  for (const row of rows) {
    const user = row.get('user');
    const userId = user && user.id ? user.id : '';
    if (!userId) continue;
    const current = byUser.get(userId) || {
      userId,
      userName: row.get('userName') || 'Torcedor',
      avatarUrl: row.get('avatarUrl') || undefined,
      checkIns: 0,
      presential: 0,
      remote: 0,
    };
    current.checkIns += 1;
    if (normalizeAttendanceMode(row.get('attendanceMode')) === 'remote') {
      current.remote += 1;
    } else {
      current.presential += 1;
    }
    byUser.set(userId, current);
  }

  return Array.from(byUser.values())
    .map((entry) => ({
      ...entry,
      engagementScore: entry.checkIns * 10 + entry.presential * 2,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore || b.checkIns - a.checkIns)
    .slice(0, limit);
});

Parse.Cloud.define('getFanEngagementSummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const checkIns = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('user', userPtr)
    .limit(1000)
    .find({ useMasterKey: true });
  let presential = 0;
  let remote = 0;
  for (const row of checkIns) {
    if (normalizeAttendanceMode(row.get('attendanceMode')) === 'remote') remote += 1;
    else presential += 1;
  }
  const roleCounts = await countConfirmedRoleEvents(userId, 'fan');
  return {
    role: 'fan',
    checkIns: checkIns.length,
    presentialCheckIns: presential,
    remoteCheckIns: remote,
    eventsCount: roleCounts.eventsCount,
    engagementScore: checkIns.length * 10 + presential * 2,
  };
});

// --- Treinador ---

Parse.Cloud.define('getCoachEventBoard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventAdminOrSupportRole(request.user, eventId, 'coach');
  let query = new Parse.Query(COACH_BOARD_CLASS).equalTo('event', event);
  if (!isAdmin) {
    query = query.equalTo('coachUser', request.user);
  }
  const row = await query.descending('updatedAt').first({ useMasterKey: true });
  return row ? mapCoachBoard(row) : null;
});

Parse.Cloud.define('saveCoachEventBoard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event } = await assertConfirmedSupportRole(request.user, eventId, 'coach');
  const checklistIn = request.params.checklist || {};
  const teamNotes = Array.isArray(request.params.teamNotes)
    ? request.params.teamNotes.map((note) => ({
        teamIndex: Math.max(0, Number(note.teamIndex) || 0),
        teamName: trimSupportText(note.teamName, 40),
        formation: trimSupportText(note.formation, 40),
        focus: trimSupportText(note.focus, 120),
      }))
    : [];
  const suggestedStarters = Array.isArray(request.params.suggestedStarters)
    ? request.params.suggestedStarters.map((line) => ({
        teamIndex: Math.max(0, Number(line.teamIndex) || 0),
        userIds: Array.isArray(line.userIds)
          ? line.userIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 20)
          : [],
      }))
    : [];

  let row = await new Parse.Query(COACH_BOARD_CLASS)
    .equalTo('event', event)
    .equalTo('coachUser', request.user)
    .first({ useMasterKey: true });
  if (!row) {
    row = new Parse.Object(COACH_BOARD_CLASS);
    row.set('event', event);
    row.set('coachUser', request.user);
  }
  row.set('checklist', {
    talkedToTeam: !!checklistIn.talkedToTeam,
    ledWarmup: !!checklistIn.ledWarmup,
    lineupDefined: !!checklistIn.lineupDefined,
  });
  row.set('teamNotes', teamNotes);
  row.set('suggestedStarters', suggestedStarters);
  row.set('rotationNotes', trimSupportText(request.params.rotationNotes, 400));
  await row.save(null, { useMasterKey: true });
  return mapCoachBoard(row);
});

Parse.Cloud.define('getCoachProfileStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const boards = await new Parse.Query(COACH_BOARD_CLASS)
    .equalTo('coachUser', userPtr)
    .limit(500)
    .find({ useMasterKey: true });
  let checklistComplete = 0;
  for (const board of boards) {
    const checklist = board.get('checklist') || {};
    if (checklist.talkedToTeam && checklist.ledWarmup && checklist.lineupDefined) {
      checklistComplete += 1;
    }
  }
  const roleCounts = await countConfirmedRoleEvents(userId, 'coach');
  return {
    role: 'coach',
    eventsCount: roleCounts.eventsCount,
    boardsSaved: boards.length,
    checklistCompleteCount: checklistComplete,
  };
});

// --- Massagista ---

Parse.Cloud.define('listMasseurTreatments', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventAdminOrSupportRole(request.user, eventId, 'masseur');
  let query = new Parse.Query(MASSEUR_TREATMENT_CLASS).equalTo('event', event).descending('createdAt');
  if (!isAdmin) {
    query = query.equalTo('masseurUser', request.user);
  }
  const rows = await query.limit(200).find({ useMasterKey: true });
  return rows.map(mapMasseurTreatment);
});

Parse.Cloud.define('upsertMasseurTreatment', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event } = await assertConfirmedSupportRole(request.user, eventId, 'masseur');
  const athleteUserId = String(request.params.athleteUserId || '').trim();
  if (!athleteUserId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'athleteUserId obrigatorio.');
  }
  const phase = String(request.params.phase || 'pre').trim();
  if (!MASSEUR_PHASES.includes(phase)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Fase de atendimento invalida.');
  }
  const returnStatus = String(request.params.returnStatus || 'cleared').trim();
  if (!MASSEUR_RETURN_STATUSES.includes(returnStatus)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Status de retorno invalido.');
  }

  const athletePtr = Parse.User.createWithoutData(athleteUserId);
  let athleteName = 'Atleta';
  try {
    const athlete = await new Parse.Query(Parse.User).get(athleteUserId, { useMasterKey: true });
    athleteName = athlete.get('apelido') || athlete.get('name') || athlete.getUsername() || athleteName;
  } catch {
    // mantem default
  }

  const objectId = String(request.params.objectId || '').trim();
  let row = null;
  if (objectId) {
    row = await new Parse.Query(MASSEUR_TREATMENT_CLASS).get(objectId, { useMasterKey: true });
    if (!row.get('masseurUser') || row.get('masseurUser').id !== request.user.id) {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Atendimento de outro massagista.');
    }
  } else {
    row = new Parse.Object(MASSEUR_TREATMENT_CLASS);
    row.set('event', event);
    row.set('masseurUser', request.user);
  }
  row.set('athleteUser', athletePtr);
  row.set('athleteName', athleteName);
  row.set('phase', phase);
  row.set('bodyRegion', trimSupportText(request.params.bodyRegion, 60));
  row.set('treatmentType', trimSupportText(request.params.treatmentType, 60));
  row.set('durationMin', Math.max(0, Math.min(180, Number(request.params.durationMin) || 0)));
  row.set('returnStatus', returnStatus);
  row.set('notes', trimSupportText(request.params.notes, 200));
  await row.save(null, { useMasterKey: true });
  return mapMasseurTreatment(row);
});

Parse.Cloud.define('getEventMasseurAlerts', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  await assertEventAdminOrSupportRole(request.user, eventId, 'masseur');
  const event = await loadSupportEvent(eventId);
  const rows = await new Parse.Query(MASSEUR_TREATMENT_CLASS)
    .equalTo('event', event)
    .containedIn('returnStatus', ['limited', 'out'])
    .descending('createdAt')
    .limit(50)
    .find({ useMasterKey: true });
  return rows.map(mapMasseurTreatment);
});

Parse.Cloud.define('getMasseurProfileStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const treatments = await new Parse.Query(MASSEUR_TREATMENT_CLASS)
    .equalTo('masseurUser', userPtr)
    .limit(1000)
    .find({ useMasterKey: true });
  const athletes = new Set();
  let totalDuration = 0;
  let limitedOrOut = 0;
  for (const row of treatments) {
    const athlete = row.get('athleteUser');
    if (athlete && athlete.id) athletes.add(athlete.id);
    totalDuration += Math.max(0, Number(row.get('durationMin') || 0));
    if (['limited', 'out'].includes(row.get('returnStatus'))) limitedOrOut += 1;
  }
  const roleCounts = await countConfirmedRoleEvents(userId, 'masseur');
  return {
    role: 'masseur',
    eventsCount: roleCounts.eventsCount,
    treatmentsCount: treatments.length,
    uniqueAthletes: athletes.size,
    avgDurationMin:
      treatments.length > 0 ? Math.round((totalDuration / treatments.length) * 10) / 10 : 0,
    limitedOrOutCount: limitedOrOut,
  };
});

// --- Preparador fisico ---

Parse.Cloud.define('getPhysicalTrainerSession', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventAdminOrSupportRole(
    request.user,
    eventId,
    'physical_trainer'
  );
  let query = new Parse.Query(TRAINER_SESSION_CLASS).equalTo('event', event);
  if (!isAdmin) {
    query = query.equalTo('trainerUser', request.user);
  }
  const row = await query.descending('updatedAt').first({ useMasterKey: true });
  return row ? mapTrainerSession(row) : null;
});

Parse.Cloud.define('savePhysicalTrainerSession', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event } = await assertConfirmedSupportRole(request.user, eventId, 'physical_trainer');
  const startTime = event.get('startTime');
  if (startTime instanceof Date && !Number.isNaN(startTime.getTime()) && new Date() >= startTime) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'A preparacao fisica so pode ser registrada antes do inicio do evento.'
    );
  }
  const planFocus = String(request.params.planFocus || 'general').trim();
  if (!TRAINER_FOCUSES.includes(planFocus)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Foco do plano invalido.');
  }
  const athleteUserIds = Array.isArray(request.params.athleteUserIds)
    ? request.params.athleteUserIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 40)
    : [];

  let row = await new Parse.Query(TRAINER_SESSION_CLASS)
    .equalTo('event', event)
    .equalTo('trainerUser', request.user)
    .first({ useMasterKey: true });
  if (!row) {
    row = new Parse.Object(TRAINER_SESSION_CLASS);
    row.set('event', event);
    row.set('trainerUser', request.user);
  }
  row.set('planFocus', planFocus);
  row.set('planDurationMin', Math.max(0, Math.min(180, Number(request.params.planDurationMin) || 0)));
  row.set('planNotes', trimSupportText(request.params.planNotes, 400));
  row.set('athleteUserIds', athleteUserIds);
  row.set('cooldownDone', !!request.params.cooldownDone);
  if (request.params.warmupStarted === true && !row.get('warmupStartedAt')) {
    row.set('warmupStartedAt', new Date());
  }
  if (request.params.warmupEnded === true) {
    row.set('warmupEndedAt', new Date());
  }
  if (request.params.clearWarmup === true) {
    row.unset('warmupStartedAt');
    row.unset('warmupEndedAt');
  }
  await row.save(null, { useMasterKey: true });
  return mapTrainerSession(row);
});

Parse.Cloud.define('getPhysicalTrainerProfileStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const sessions = await new Parse.Query(TRAINER_SESSION_CLASS)
    .equalTo('trainerUser', userPtr)
    .limit(500)
    .find({ useMasterKey: true });
  const athletes = new Set();
  let warmupsCompleted = 0;
  for (const session of sessions) {
    const ids = Array.isArray(session.get('athleteUserIds')) ? session.get('athleteUserIds') : [];
    ids.forEach((id) => athletes.add(id));
    if (session.get('warmupStartedAt') && session.get('warmupEndedAt')) warmupsCompleted += 1;
  }
  const personalAthletes = await new Parse.Query('AthleteProfile')
    .equalTo('personalTrainerUserId', userId)
    .limit(200)
    .find({ useMasterKey: true });
  const roleCounts = await countConfirmedRoleEvents(userId, 'physical_trainer');
  return {
    role: 'physical_trainer',
    eventsCount: roleCounts.eventsCount,
    sessionsCount: sessions.length,
    warmupsCompleted,
    athletesCoachedInEvents: athletes.size,
    personalAthletesCount: personalAthletes.length,
  };
});

Parse.Cloud.define('getEventSupportOpsSnapshot', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  let event;
  try {
    event = await assertEventAdmin(request.user, eventId);
  } catch {
    event = await loadSupportEvent(eventId);
    const registration = await loadSupportRegistration(request.user, event);
    const fee = Number(event.get('participationFee') || 0);
    // qualquer participante confirmado pode ver o resumo no mural
    if (!registration || !computeRegistrationEffectiveConfirmation(registration, fee)) {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Participacao nao confirmada.');
    }
  }

  const coachBoard = await new Parse.Query(COACH_BOARD_CLASS)
    .equalTo('event', event)
    .descending('updatedAt')
    .first({ useMasterKey: true });
  const trainerSession = await new Parse.Query(TRAINER_SESSION_CLASS)
    .equalTo('event', event)
    .descending('updatedAt')
    .first({ useMasterKey: true });
  const treatments = await new Parse.Query(MASSEUR_TREATMENT_CLASS)
    .equalTo('event', event)
    .limit(200)
    .find({ useMasterKey: true });
  const fanCheckIns = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });
  const alerts = treatments.filter((row) => ['limited', 'out'].includes(row.get('returnStatus')));

  return {
    eventId,
    coach: coachBoard
      ? {
          checklist: mapCoachBoard(coachBoard).checklist,
          hasBoard: true,
        }
      : { hasBoard: false, checklist: null },
    trainer: trainerSession
      ? {
          hasSession: true,
          planFocus: trainerSession.get('planFocus') || 'general',
          athleteCount: Array.isArray(trainerSession.get('athleteUserIds'))
            ? trainerSession.get('athleteUserIds').length
            : 0,
          warmupActive: !!(
            trainerSession.get('warmupStartedAt') && !trainerSession.get('warmupEndedAt')
          ),
          warmupDone: !!(
            trainerSession.get('warmupStartedAt') && trainerSession.get('warmupEndedAt')
          ),
          cooldownDone: !!trainerSession.get('cooldownDone'),
        }
      : { hasSession: false },
    masseur: {
      treatmentsCount: treatments.length,
      alertsCount: alerts.length,
      alerts: alerts.slice(0, 5).map(mapMasseurTreatment),
    },
    fan: {
      checkIns: fanCheckIns.length,
      presential: fanCheckIns.filter(
        (row) => normalizeAttendanceMode(row.get('attendanceMode')) === 'presential'
      ).length,
      remote: fanCheckIns.filter(
        (row) => normalizeAttendanceMode(row.get('attendanceMode')) === 'remote'
      ).length,
    },
  };
});

Parse.Cloud.define('configureSupportRolesClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const denied = {};
  const classes = [
    FAN_CHECKIN_CLASS,
    COACH_BOARD_CLASS,
    MASSEUR_TREATMENT_CLASS,
    TRAINER_SESSION_CLASS,
  ];

  for (const className of classes) {
    const schema = new Parse.Schema(className);
    schema.setCLP({
      find: authRead,
      get: authRead,
      count: authRead,
      create: denied,
      update: denied,
      delete: denied,
      addField: denied,
      protectedFields: {},
    });
    try {
      await schema.update();
    } catch {
      await schema.save();
    }
  }

  return {
    ok: true,
    message:
      'CLP atualizado para FanEventCheckIn, CoachEventBoard, MasseurTreatment e PhysicalTrainerSession.',
  };
});

/** Eventos — inscricoes, chegada, pagamento e contratacao suplementar */

/** Eventos — inscricoes, chegada, pagamento e contratacao suplementar */

// Inscricoes, chegada e separacao de times
function isSocioMembershipType(membershipType) {
  return String(membershipType || 'convidado') === 'socio';
}

function getRegistrationUserId(registration) {
  const explicit = registration.get('participantUserId');
  if (explicit) {
    return String(explicit);
  }
  const user = registration.get('user');
  return user && user.id ? String(user.id) : '';
}

async function loadActiveSocioUserIdsForEvent(event) {
  const pelada = event.get('pelada');
  if (!pelada || !pelada.id) {
    return new Set();
  }

  const memberships = await new Parse.Query('PeladaMembership')
    .equalTo('pelada', pelada)
    .equalTo('status', 'active')
    .limit(1000)
    .find({ useMasterKey: true });

  const ids = new Set();
  for (const membership of memberships) {
    const memberUserId = membership.get('memberUserId');
    if (memberUserId) {
      ids.add(String(memberUserId));
      continue;
    }
    const user = membership.get('user');
    if (user && user.id) {
      ids.add(String(user.id));
    }
  }
  return ids;
}

function isEffectiveSocioRegistration(registration, activeSocioUserIds) {
  const userId = getRegistrationUserId(registration);
  if (userId && activeSocioUserIds.has(userId)) {
    return true;
  }
  return isSocioMembershipType(registration.get('membershipType'));
}

function isEventAdminRegistration(registration, eventAdminId) {
  if (!eventAdminId) {
    return false;
  }
  const userId = getRegistrationUserId(registration);
  if (userId && userId === eventAdminId) {
    return true;
  }
  const user = registration.get('user');
  return !!(user && user.id && String(user.id) === eventAdminId);
}

function isRegularSocioRegistration(registration, eventAdminId, activeSocioUserIds) {
  if (isEventAdminRegistration(registration, eventAdminId)) {
    return false;
  }
  return isEffectiveSocioRegistration(registration, activeSocioUserIds);
}

function compareArrivedAt(a, b) {
  const aTime = a.get('arrivedAt') ? a.get('arrivedAt').getTime() : 0;
  const bTime = b.get('arrivedAt') ? b.get('arrivedAt').getTime() : 0;
  return aTime - bTime;
}

function buildArrivalOrderList(arrived, eventAdminId, activeSocioUserIds) {
  const adminArrived = [];
  const sociosArrived = [];
  const convidadosArrived = [];

  for (const registration of arrived) {
    if (isEventAdminRegistration(registration, eventAdminId)) {
      adminArrived.push(registration);
      continue;
    }
    if (isRegularSocioRegistration(registration, eventAdminId, activeSocioUserIds)) {
      sociosArrived.push(registration);
      continue;
    }
    convidadosArrived.push(registration);
  }

  adminArrived.sort(compareArrivedAt);
  sociosArrived.sort(compareArrivedAt);
  convidadosArrived.sort(compareArrivedAt);

  return [...adminArrived, ...sociosArrived, ...convidadosArrived];
}

function getArrivalPriorityTier(registration, eventAdminId, activeSocioUserIds) {
  if (isEventAdminRegistration(registration, eventAdminId)) {
    return 0;
  }
  if (isRegularSocioRegistration(registration, eventAdminId, activeSocioUserIds)) {
    return 1;
  }
  return 2;
}

function compareArrivalPriority(a, b, eventAdminId, activeSocioUserIds) {
  const tierA = getArrivalPriorityTier(a, eventAdminId, activeSocioUserIds);
  const tierB = getArrivalPriorityTier(b, eventAdminId, activeSocioUserIds);
  if (tierA !== tierB) {
    return tierA - tierB;
  }
  return compareArrivedAt(a, b);
}

async function recalculateEventArrivalOrders(eventId) {
  const event = await new Parse.Query('Event')
    .include('admin')
    .include('pelada')
    .get(eventId, { useMasterKey: true });

  const eventAdminId = event.get('admin') && event.get('admin').id ? String(event.get('admin').id) : '';
  const activeSocioUserIds = await loadActiveSocioUserIdsForEvent(event);
  const eventPtr = Parse.Object.extend('Event').createWithoutData(eventId);
  const allQuery = new Parse.Query('EventRegistration');
  allQuery.equalTo('event', eventPtr);
  allQuery.equalTo('role', 'athlete');
  allQuery.limit(500);
  const allAthletes = await allQuery.find({ useMasterKey: true });

  const arrived = allAthletes.filter((registration) => registration.get('arrivedAt'));
  const ordered = buildArrivalOrderList(arrived, eventAdminId, activeSocioUserIds);

  const orderById = new Map();
  ordered.forEach((registration, index) => {
    orderById.set(registration.id, index + 1);
  });

  const toSave = [];
  for (const registration of allAthletes) {
    const order = orderById.get(registration.id);
    if (order != null) {
      if (registration.get('arrivalOrder') !== order) {
        registration.set('arrivalOrder', order);
        toSave.push(registration);
      }
    } else if (registration.get('arrivalOrder') != null) {
      registration.unset('arrivalOrder');
      toSave.push(registration);
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }
}

Parse.Cloud.define('registerEventAthleteArrival', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const registrationId = request.params.registrationId
    ? String(request.params.registrationId)
    : '';
  const action = String(request.params.action || 'check_in');

  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId obrigatorios.');
  }
  if (action !== 'check_in' && action !== 'undo') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Acao invalida.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const eventType = event.get('type');
  if (eventType !== 'pelada' && eventType !== 'racha') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ordem de chegada aplica-se apenas a eventos Pelada e Racha.'
    );
  }

  if (!event.get('useArrivalOrderForTeams')) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ordem de chegada nao esta ativa neste evento.'
    );
  }

  const readOnlyAt = event.get('readOnlyAt');
  if (readOnlyAt && new Date() >= readOnlyAt) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Evento encerrado.');
  }

  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador pode registrar chegada.'
    );
  }

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }

  if (registration.get('role') !== 'athlete') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ordem de chegada aplica-se apenas a atletas.'
    );
  }

  if (action === 'check_in') {
    if (registration.get('arrivedAt')) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Chegada ja registrada para este atleta.');
    }
    registration.set('arrivedAt', new Date());
    await registration.save(null, { useMasterKey: true });
  } else {
    if (!registration.get('arrivedAt')) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este atleta ainda nao registrou chegada.');
    }
    registration.unset('arrivedAt');
    await registration.save(null, { useMasterKey: true });
  }

  await recalculateEventArrivalOrders(eventId);
  return { ok: true };
});

Parse.Cloud.define('ensureEventArrivalOrders', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador pode recalcular ordem de chegada.'
    );
  }

  if (!event.get('useArrivalOrderForTeams')) {
    return { ok: true, skipped: true };
  }

  await recalculateEventArrivalOrders(eventId);
  return { ok: true };
});

function computeRegistrationEffectiveConfirmation(registration, participationFee) {
  const presentationStatus = registration.get('profilePresentationStatus');
  if (presentationStatus === 'pending' || presentationStatus === 'rejected') {
    return false;
  }
  const paymentConfirmed = !!registration.get('paymentConfirmed');
  const paymentExempt = !!registration.get('paymentExempt');
  if (registration.get('invitedByContract') || registration.get('invitedAsReferee')) {
    return true;
  }
  if (registration.get('isAnonymous')) {
    return true;
  }
  if (participationFee <= 0) return true;
  if (paymentExempt) return true;
  return paymentConfirmed;
}

async function resolveRegistrationParticipantUserId(registration) {
  const existing = registration.get('participantUserId');
  if (existing) {
    return { userId: String(existing), shouldSave: false };
  }

  const userPtr = registration.get('user');
  if (!userPtr) {
    return { userId: '', shouldSave: false };
  }

  let user = userPtr;
  try {
    if (!user.get || typeof user.get !== 'function') {
      user = await new Parse.Query(Parse.User).get(userPtr.id, { useMasterKey: true });
    } else if (!user.get('apelido') && !user.get('name') && user.id) {
      user = await user.fetch({ useMasterKey: true });
    }
  } catch {
    return { userId: userPtr.id ? String(userPtr.id) : '', shouldSave: false };
  }

  if (!user || !user.id) {
    return { userId: '', shouldSave: false };
  }

  registration.set('participantUserId', user.id);
  applyRegistrationUserDisplayFields(registration, user);
  return { userId: String(user.id), shouldSave: true };
}

function mapRegistrationForEventListItem(registration, eventId, participationFee, athleteProfile) {
  const athlete = athleteProfile || registration.get('athlete');
  const arrivedAt = registration.get('arrivedAt');
  const paymentConfirmed = !!registration.get('paymentConfirmed');
  const paymentExempt = !!registration.get('paymentExempt');
  const profilePresentationStatus = registration.get('profilePresentationStatus') || null;
  const userPtr = registration.get('user');
  const birthDate = userPtr && userPtr.get ? userPtr.get('birthDate') : null;
  const age =
    typeof calcAgeFromBirthDate === 'function' ? calcAgeFromBirthDate(birthDate) : null;

  return {
    objectId: registration.id,
    eventId,
    userId: String(registration.get('participantUserId') || ''),
    userName:
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      registration.get('userApelido') ||
      'Participante',
    apelido: registration.get('apelido') || '',
    role: registration.get('role') || 'athlete',
    committed: !!registration.get('committed'),
    membershipType: registration.get('membershipType') || 'convidado',
    attendance: registration.get('attendance') || 'pending',
    paymentConfirmed,
    paymentExempt,
    isEffectivelyConfirmed: computeRegistrationEffectiveConfirmation(
      registration,
      participationFee
    ),
    invitedByContract: !!registration.get('invitedByContract'),
    invitedAsReferee: !!registration.get('invitedAsReferee'),
    contractOfferedAmount:
      registration.get('contractOfferedAmount') != null
        ? Number(registration.get('contractOfferedAmount'))
        : undefined,
    profilePresentationStatus,
    arrivalOrder:
      registration.get('arrivalOrder') != null ? Number(registration.get('arrivalOrder')) : undefined,
    arrivedAt: arrivedAt ? arrivedAt.toISOString() : undefined,
    avatarUrl: registration.get('avatarUrl') || undefined,
    primaryPosition:
      athlete && athlete.get ? athlete.get('primaryPosition') || undefined : undefined,
    isAnonymous: !!registration.get('isAnonymous'),
    gateTicketActive:
      !!registration.get('gateTicketToken') && !registration.get('gateTicketCancelledAt'),
    teamSide:
      registration.get('teamSide') === 'home' || registration.get('teamSide') === 'away'
        ? registration.get('teamSide')
        : undefined,
    age: age != null && !Number.isNaN(age) ? age : null,
    appAverageScore: null,
    teamName: undefined,
  };
}

async function buildAppAverageVoteScores(userIds) {
  const scores = new Map();
  if (!userIds || !userIds.size) return scores;
  for (const userId of userIds) {
    scores.set(userId, null);
  }

  const idList = Array.from(userIds);
  const chunkSize = 50;
  const voteAgg = new Map();

  for (let i = 0; i < idList.length; i += chunkSize) {
    const chunk = idList.slice(i, i + chunkSize);
    const votes = await new Parse.Query('MuralVote')
      .containedIn('targetUserId', chunk)
      .limit(5000)
      .find({ useMasterKey: true });

    const eventIds = [
      ...new Set(
        votes
          .map((vote) => String(vote.get('scopeId') || '').trim())
          .filter(Boolean)
      ),
    ];
    const typeById = new Map();
    for (let j = 0; j < eventIds.length; j += 50) {
      const eventChunk = eventIds.slice(j, j + 50);
      if (!eventChunk.length) continue;
      const events = await new Parse.Query('Event')
        .containedIn('objectId', eventChunk)
        .select(['type'])
        .limit(eventChunk.length)
        .find({ useMasterKey: true });
      for (const event of events) {
        typeById.set(event.id, event.get('type') || '');
      }
    }

    for (const vote of votes) {
      const targetUserId = String(
        vote.get('targetUserId') ||
          (vote.get('targetUser') && vote.get('targetUser').id ? vote.get('targetUser').id : '')
      );
      if (!targetUserId || !userIds.has(targetUserId)) continue;
      const scopeId = String(vote.get('scopeId') || '');
      const weight = typeById.get(scopeId) === 'team_match' ? 3 : 1;
      const score = Number(vote.get('score') || 0);
      const current = voteAgg.get(targetUserId) || { weighted: 0, weightSum: 0 };
      current.weighted += score * weight;
      current.weightSum += weight;
      voteAgg.set(targetUserId, current);
    }
  }

  for (const [userId, data] of voteAgg.entries()) {
    if (data.weightSum > 0) {
      scores.set(userId, Math.round((data.weighted / data.weightSum) * 10) / 10);
    }
  }
  return scores;
}

async function enrichEventRegistrationListRows(rows, event) {
  if (!rows.length) return rows;
  const userIds = new Set(rows.map((row) => String(row.userId || '')).filter(Boolean));
  const averages = await buildAppAverageVoteScores(userIds);
  const homeName = event.get('homeTeamName') || 'Mandante';
  const awayName = event.get('awayTeamName') || 'Visitante';
  const isTeamMatch = event.get('type') === 'team_match';

  for (const row of rows) {
    const avg = averages.get(String(row.userId || ''));
    row.appAverageScore = avg != null ? avg : null;
    if (isTeamMatch && (row.role === 'athlete' || row.role === 'goalkeeper')) {
      if (row.teamSide === 'home') row.teamName = homeName;
      else if (row.teamSide === 'away') row.teamName = awayName;
      else row.teamName = undefined;
    }
  }
  return rows;
}

function sortTeamMatchRegistrationRows(rows, event) {
  if (!event || event.get('type') !== 'team_match' || !Array.isArray(rows)) {
    return rows;
  }
  const sideRank = (side) => (side === 'home' ? 0 : side === 'away' ? 1 : 2);
  rows.sort((a, b) => {
    const sideDiff = sideRank(a.teamSide) - sideRank(b.teamSide);
    if (sideDiff !== 0) return sideDiff;
    return String(a.apelido || a.userName || '').localeCompare(
      String(b.apelido || b.userName || ''),
      'pt-BR'
    );
  });
  return rows;
}

async function resolveRegistrationAthleteProfile(registration) {
  let athlete = registration.get('athlete');
  if (athlete && !athlete.get && athlete.id) {
    try {
      athlete = await new Parse.Query('AthleteProfile').get(athlete.id, { useMasterKey: true });
    } catch {
      athlete = null;
    }
  }

  if (athlete && athlete.get && athlete.get('primaryPosition')) {
    return { athlete, shouldSave: false };
  }

  const role = registration.get('role');
  if (role !== 'athlete' && role !== 'goalkeeper') {
    return { athlete: athlete || null, shouldSave: false };
  }

  const userPtr = registration.get('user');
  if (!userPtr || !userPtr.id) {
    return { athlete: athlete || null, shouldSave: false };
  }

  const profile = await new Parse.Query('AthleteProfile')
    .equalTo('user', userPtr)
    .first({ useMasterKey: true });
  if (!profile) {
    return { athlete: athlete || null, shouldSave: false };
  }

  registration.set('athlete', profile);
  return { athlete: profile, shouldSave: true };
}

Parse.Cloud.define('listEventParticipantsForVoting', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);

  const ownRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (!ownRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes inscritos podem ver a lista para votacao.'
    );
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .include('athlete')
    .ascending('arrivalOrder')
    .addAscending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const rows = [];

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) {
      continue;
    }

    if (resolved.shouldSave) {
      toSave.push(registration);
    }

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    if (!row.isEffectivelyConfirmed) {
      continue;
    }

    rows.push(row);
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  rows.sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));
  return sortTeamMatchRegistrationRows(
    await enrichEventRegistrationListRows(rows, event),
    event
  );
});

Parse.Cloud.define('listEventRegistrationsForAdmin', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador do evento pode ver a lista completa de participantes.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .include('athlete')
    .ascending('arrivalOrder')
    .addAscending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const rows = [];

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) {
      continue;
    }

    if (resolved.shouldSave) {
      toSave.push(registration);
    }

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    row.userId = resolved.userId;
    rows.push(row);
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  rows.sort((a, b) => {
    const orderDiff = (a.arrivalOrder ?? 9999) - (b.arrivalOrder ?? 9999);
    if (orderDiff !== 0) return orderDiff;
    return (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR');
  });

  return sortTeamMatchRegistrationRows(
    await enrichEventRegistrationListRows(rows, event),
    event
  );
});

function athletePositionsFromProfile(athlete) {
  if (!athlete || !athlete.get) {
    return {
      primaryPosition: undefined,
      secondaryPosition: undefined,
      thirdPosition: undefined,
    };
  }
  return {
    primaryPosition: athlete.get('primaryPosition') || undefined,
    secondaryPosition: athlete.get('secondaryPosition') || undefined,
    thirdPosition: athlete.get('thirdPosition') || undefined,
  };
}

Parse.Cloud.define('listEventAthletesForPredictions', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);

  const ownRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (!ownRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes inscritos podem fazer palpites.'
    );
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .ascending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const athletes = [];
  const seen = new Set();

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId || seen.has(resolved.userId)) {
      continue;
    }

    if (resolved.shouldSave) {
      toSave.push(registration);
    }

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    if (!row.isEffectivelyConfirmed) {
      continue;
    }

    seen.add(resolved.userId);
    const user = registration.get('user');
    athletes.push({
      userId: resolved.userId,
      userName: row.userName,
      apelido: row.apelido || row.userName,
      avatarUrl: resolveStoredAvatarUrl(user, registration),
      teamSide: row.teamSide,
      ...athletePositionsFromProfile(athleteResolved.athlete),
    });
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  athletes.sort((a, b) => (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR'));
  return athletes;
});

async function buildPeladaAthleteAverageVoteScores(peladaId, userIds) {
  const scores = new Map();
  if (!peladaId || !userIds || !userIds.size) {
    return scores;
  }

  for (const userId of userIds) {
    scores.set(userId, 0);
  }

  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const events = await new Parse.Query('Event')
    .equalTo('pelada', pelada)
    .limit(500)
    .find({ useMasterKey: true });

  const eventIds = events.map((event) => event.id).filter(Boolean);
  if (!eventIds.length) {
    return scores;
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const eventPtrs = eventIds.map((id) => Parse.Object.extend('Event').createWithoutData(id));

  const registrations = await new Parse.Query('EventRegistration')
    .containedIn('event', eventPtrs)
    .equalTo('role', 'athlete')
    .include('user')
    .limit(5000)
    .find({ useMasterKey: true });

  const participationByUser = new Map();
  for (const registration of registrations) {
    const userId = getRegistrationUserId(registration);
    if (!userId || !userIds.has(userId)) continue;

    const event = registration.get('event');
    const eventId = event && event.id ? event.id : null;
    if (!eventId) continue;

    const eventObj = eventById.get(eventId);
    const participationFee = Number((eventObj && eventObj.get('participationFee')) || 0);
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }

    if (!participationByUser.has(userId)) {
      participationByUser.set(userId, new Set());
    }
    participationByUser.get(userId).add(eventId);
  }

  const eventVoteQuery = new Parse.Query('MuralVote');
  eventVoteQuery.equalTo('scope', 'event');
  eventVoteQuery.containedIn('scopeId', eventIds);
  eventVoteQuery.equalTo('targetRole', 'athlete');
  eventVoteQuery.limit(5000);
  const votes = await eventVoteQuery.find({ useMasterKey: true });

  const voteSumByUser = new Map();
  for (const userId of userIds) {
    voteSumByUser.set(userId, 0);
  }

  for (const vote of votes) {
    const targetUser = vote.get('targetUser');
    const targetUserId = String(
      vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
    );
    if (!targetUserId || !userIds.has(targetUserId)) continue;

    const scopeId = String(vote.get('scopeId') || '');
    const userEvents = participationByUser.get(targetUserId);
    if (!userEvents || !userEvents.has(scopeId)) continue;

    const score = Number(vote.get('score') || 0);
    voteSumByUser.set(targetUserId, (voteSumByUser.get(targetUserId) || 0) + score);
  }

  for (const userId of userIds) {
    const eventCount = participationByUser.get(userId)?.size || 0;
    if (eventCount <= 0) {
      scores.set(userId, 0);
      continue;
    }
    const totalVotes = voteSumByUser.get(userId) || 0;
    scores.set(userId, totalVotes / eventCount);
  }

  return scores;
}

Parse.Cloud.define('listEventAthletesForTeamSplit', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const ended = isEventEndedForTeamSplit(event);
  if (!ended) {
    const admin = event.get('admin');
    if (!admin || admin.id !== user.id) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'Apenas o administrador pode separar times.'
      );
    }
  } else {
    const admin = event.get('admin');
    const isAdmin = !!(admin && admin.id === user.id);
    if (!isAdmin && !hasSavedTeamSplit(event)) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'A separacao de times ainda nao foi registrada para este evento.'
      );
    }
  }

  const pelada = event.get('pelada');
  const peladaId = pelada && pelada.id ? pelada.id : null;
  const participationFee = Number(event.get('participationFee') || 0);
  const activeSocioIds = await loadActiveSocioUserIdsForEvent(event);

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const pendingRows = [];

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;

    if (resolved.shouldSave) toSave.push(registration);

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    if (!row.isEffectivelyConfirmed) continue;

    pendingRows.push({
      registration,
      resolved,
      row,
      athleteResolved,
    });
  }

  const userIds = new Set(pendingRows.map((item) => item.resolved.userId));
  const averageVoteScores = peladaId
    ? await buildPeladaAthleteAverageVoteScores(peladaId, userIds)
    : new Map();

  const athletes = [];

  for (const item of pendingRows) {
    const { registration, resolved, row, athleteResolved } = item;
    const userPtr = registration.get('user');
    const birthDate = userPtr && userPtr.get ? userPtr.get('birthDate') : null;
    const athleteProfile = athleteResolved.athlete;
    const address = userPtr && userPtr.get ? userPtr.get('address') || {} : {};
    const neighborhood = normalizeLocationLabel(address.neighborhood);

    athletes.push({
      userId: resolved.userId,
      registrationId: registration.id,
      apelido: row.apelido || row.userName,
      userName: row.userName,
      avatarUrl: resolveStoredAvatarUrl(userPtr, registration),
      primaryPosition:
        athleteProfile && athleteProfile.get
          ? athleteProfile.get('primaryPosition') || undefined
          : undefined,
      age: calcAgeFromBirthDate(birthDate),
      accumulatedPoints: averageVoteScores.get(resolved.userId) || 0,
      membershipType: registration.get('membershipType') || 'convidado',
      isSocio: isEffectiveSocioRegistration(registration, activeSocioIds),
      maritalStatus:
        athleteProfile && athleteProfile.get ? athleteProfile.get('maritalStatus') || undefined : undefined,
      footPreference:
        athleteProfile && athleteProfile.get ? athleteProfile.get('footPreference') || undefined : undefined,
      favoriteProTeam: readUserFavoriteProTeam(
        userPtr,
        athleteProfile && athleteProfile.get ? athleteProfile.get('favoriteProTeam') : undefined
      ),
      neighborhood: neighborhood || undefined,
      arrivalOrder:
        row.arrivalOrder != null ? Number(row.arrivalOrder) : undefined,
      arrivedAt: row.arrivedAt || undefined,
    });
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  athletes.sort((a, b) => {
    const orderDiff = (a.arrivalOrder ?? 9999) - (b.arrivalOrder ?? 9999);
    if (orderDiff !== 0) return orderDiff;
    return (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR');
  });

  return athletes;
});

const VALID_TEAM_SPLIT_MODES = [
  'manual',
  'random',
  'maritalSides',
  'favoriteTeamSides',
  'ageSides',
];

function normalizeTeamSplitMode(value) {
  const mode = String(value || 'manual');
  return VALID_TEAM_SPLIT_MODES.includes(mode) ? mode : 'manual';
}

function normalizeEventTeamSplitState(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const athletesPerTeam = Number(raw.athletesPerTeam);
  const teamCount = Number(raw.teamCount);
  const splitMode = normalizeTeamSplitMode(raw.splitMode);
  const randomStrategy = String(raw.randomStrategy || 'default');
  const teamsRaw = raw.teams;
  const ageThresholdRaw = Number(raw.ageThreshold);

  if (!Array.isArray(teamsRaw) || !athletesPerTeam || !teamCount) {
    return null;
  }

  const teams = teamsRaw
    .map((team) =>
      Array.isArray(team) ? team.map((userId) => String(userId || '')).filter(Boolean) : []
    )
    .slice(0, 8);

  const result = {
    athletesPerTeam: Math.max(1, Math.min(20, athletesPerTeam)),
    teamCount: Math.max(1, Math.min(8, teamCount)),
    splitMode,
    randomStrategy: ['default', 'marital', 'favoriteTeam', 'neighborhood'].includes(randomStrategy)
      ? randomStrategy
      : 'default',
    teams,
    savedAt: raw.savedAt ? String(raw.savedAt) : undefined,
  };

  if (splitMode === 'ageSides' && ageThresholdRaw >= 1 && ageThresholdRaw <= 99) {
    result.ageThreshold = ageThresholdRaw;
  }

  return result;
}

async function assertEventAdmin(event, user) {
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador pode gerenciar a separacao de times.'
    );
  }
}

function isEventEndedForTeamSplit(event) {
  return (
    !!event.get('isFinished') ||
    (event.get('endTime') instanceof Date && event.get('endTime') < new Date())
  );
}

async function loadPeladaForEvent(event) {
  const peladaRef = event.get('pelada');
  const peladaId = peladaRef && peladaRef.id ? peladaRef.id : null;
  if (!peladaId) return null;

  if (
    peladaRef.get &&
    typeof peladaRef.get('allowTeamSplitAfterEventEnd') === 'boolean'
  ) {
    return peladaRef;
  }

  return new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
}

async function isTeamSplitAfterEventEndAllowed(event) {
  if (!isEventEndedForTeamSplit(event)) return true;

  const pelada = await loadPeladaForEvent(event);
  return !!(pelada && pelada.get('allowTeamSplitAfterEventEnd'));
}

function hasSavedTeamSplit(event) {
  const existing = normalizeEventTeamSplitState(event.get('teamSplit'));
  return !!(existing && existing.teams.some((team) => team.length > 0));
}

async function assertCanManageTeamSplit(event, user) {
  await assertEventAdmin(event, user);

  if (!isEventEndedForTeamSplit(event)) return;

  const allowed = await isTeamSplitAfterEventEndAllowed(event);
  if (!allowed) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'A separacao de times apos o termino do evento nao esta permitida nesta pelada.'
    );
  }
}

Parse.Cloud.define('getEventTeamSplit', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const ended = isEventEndedForTeamSplit(event);
  if (!ended) {
    await assertEventAdmin(event, user);
  } else {
    const admin = event.get('admin');
    const isAdmin = !!(admin && admin.id === user.id);
    if (!isAdmin && !hasSavedTeamSplit(event)) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'A separacao de times ainda nao foi registrada para este evento.'
      );
    }
  }

  return normalizeEventTeamSplitState(event.get('teamSplit'));
});

Parse.Cloud.define('saveEventTeamSplit', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  await assertCanManageTeamSplit(event, user);

  const athletesPerTeam = Number(request.params.athletesPerTeam);
  const teamCount = Number(request.params.teamCount);
  const splitMode = String(request.params.splitMode || 'manual');
  const randomStrategy = request.params.randomStrategy
    ? String(request.params.randomStrategy)
    : 'default';
  const teamsRaw = request.params.teams;

  if (!Array.isArray(teamsRaw)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'teams invalido.');
  }

  const teams = teamsRaw
    .map((team) =>
      Array.isArray(team) ? team.map((userId) => String(userId || '')).filter(Boolean) : []
    )
    .slice(0, 8);

  const normalizedMode = normalizeTeamSplitMode(splitMode);
  const ageThreshold = Number(request.params.ageThreshold);

  const payload = {
    athletesPerTeam: Math.max(1, Math.min(20, athletesPerTeam || 1)),
    teamCount: Math.max(1, Math.min(8, teamCount || 1)),
    splitMode: normalizedMode,
    randomStrategy: ['default', 'marital', 'favoriteTeam', 'neighborhood'].includes(randomStrategy)
      ? randomStrategy
      : 'default',
    teams,
    savedAt: new Date().toISOString(),
  };

  if (normalizedMode === 'ageSides' && ageThreshold >= 1 && ageThreshold <= 99) {
    payload.ageThreshold = ageThreshold;
  }

  event.set('teamSplit', payload);
  await event.save(null, { useMasterKey: true });

  return normalizeEventTeamSplitState(payload);
});

Parse.Cloud.define('clearEventTeamSplit', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  await assertCanManageTeamSplit(event, user);

  const readOnlyAt = event.get('readOnlyAt');
  if (readOnlyAt && new Date() >= readOnlyAt) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Evento encerrado.');
  }

  if (!hasSavedTeamSplit(event)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Nao ha separacao de times salva para este evento.'
    );
  }

  event.unset('teamSplit');
  await event.save(null, { useMasterKey: true });

  return { ok: true };
});

// Pagamento e inscricao anonima
async function assertEventAdmin(user, eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (!admin || !user || admin.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o administrador do evento.');
  }
  return event;
}

Parse.Cloud.define('updateEventRegistrationPayment', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const registrationId = request.params.registrationId ? String(request.params.registrationId) : '';
  const mode = request.params.mode ? String(request.params.mode) : 'confirmed';
  const value = !!request.params.value;

  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId sao obrigatorios.');
  }

  const event = await assertEventAdmin(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .include('user')
    .include('athlete')
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }

  if (mode === 'exempt') {
    registration.set('paymentExempt', value);
    if (value) {
      registration.set('paymentConfirmed', false);
    }
  } else {
    registration.set('paymentConfirmed', value);
    if (value) {
      registration.set('paymentExempt', false);
    }
  }

  const isEffectivelyConfirmed = computeRegistrationEffectiveConfirmation(
    registration,
    participationFee
  );
  registration.set('isEffectivelyConfirmed', isEffectivelyConfirmed);
  await registration.save(null, { useMasterKey: true });
  await maybeIssueGateTicketForRegistration(registration, event, user);

  return mapRegistrationForEventListItem(registration, eventId, participationFee);
});

Parse.Cloud.define('createAnonymousEventRegistration', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const apelido = String(request.params.apelido || '').trim();
  const role = String(request.params.role || 'athlete').trim();

  if (!eventId || apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe eventId e apelido (min. 2 caracteres).');
  }

  const event = await assertEventAdmin(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);

  const duplicateQuery = new Parse.Query('EventRegistration');
  duplicateQuery.equalTo('event', event);
  duplicateQuery.equalTo('apelido', apelido);
  const duplicate = await duplicateQuery.first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Apelido ja utilizado neste evento.');
  }

  const participantUserId = `anon_${new Date().getTime()}_${Math.random().toString(36).slice(2, 10)}`;
  const registration = new Parse.Object('EventRegistration');
  registration.set('event', event);
  registration.set('role', role);
  registration.set('apelido', apelido);
  registration.set('userDisplayName', apelido);
  registration.set('participantUserId', participantUserId);
  registration.set('isAnonymous', true);
  registration.set('committed', true);
  registration.set('membershipType', 'convidado');
  registration.set('attendance', 'pending');
  registration.set('paymentConfirmed', false);
  registration.set('paymentExempt', true);
  registration.set('isEffectivelyConfirmed', true);

  const pelada = event.get('pelada');
  if (pelada) {
    registration.set('pelada', pelada);
  }

  await registration.save(null, { useMasterKey: true });
  return mapRegistrationForEventListItem(registration, eventId, participationFee);
});

Parse.Cloud.define('setEventRegistrationTeamSide', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const registrationId = String(request.params.registrationId || '').trim();
  const teamSide = request.params.teamSide === 'away' ? 'away' : request.params.teamSide === 'home' ? 'home' : '';
  if (!registrationId || !teamSide) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a inscricao e o time (mandante ou visitante).');
  }

  const registration = await new Parse.Query('EventRegistration').get(registrationId, {
    useMasterKey: true,
  });
  const event = registration.get('event');
  if (!event || !event.id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Inscricao sem evento.');
  }

  const eventObj = await assertEventAdmin(user, event.id);
  if (eventObj.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'So confrontos entre times usam lado mandante/visitante.');
  }
  if (registration.get('role') !== 'athlete') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'So atletas entram no confronto por time.');
  }

  registration.set('teamSide', teamSide);
  await registration.save(null, { useMasterKey: true });
  const participationFee = Number(eventObj.get('participationFee') || 0);
  const athleteResolved = await resolveRegistrationAthleteProfile(registration);
  return mapRegistrationForEventListItem(
    registration,
    eventObj.id,
    participationFee,
    athleteResolved.athlete
  );
});

// Contratacao suplementar
Parse.Cloud.define('createSupplementaryEventInvitation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const invitedUserId = request.params.invitedUserId ? String(request.params.invitedUserId) : '';
  const offeredAmount = Number(request.params.offeredAmount ?? 0);
  const responseDeadlineRaw = request.params.responseDeadline;
  const kind =
    request.params.kind === 'marking_assistant' ? 'marking_assistant' : 'flag_assistant';

  if (!eventId || !invitedUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId e invitedUserId sao obrigatorios.'
    );
  }
  if (offeredAmount < 0) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe um valor valido.');
  }
  const responseDeadline = responseDeadlineRaw ? new Date(responseDeadlineRaw) : null;
  if (!responseDeadline || Number.isNaN(responseDeadline.getTime()) || responseDeadline <= new Date()) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe prazo valido para resposta.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Evento ja encerrado.');
  }

  const requiredRole = kind === 'marking_assistant' ? 'scout' : 'referee';
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', requiredRole)
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce precisa estar confirmado neste evento.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Inscricao nao confirmada neste evento.'
    );
  }

  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  const duplicateQuery = new Parse.Query('RefereeInvitation');
  duplicateQuery.equalTo('event', event);
  duplicateQuery.equalTo('invitedUser', invitedUser);
  duplicateQuery.equalTo('role', requiredRole);
  duplicateQuery.containedIn('status', ['pending', 'accepted']);
  const duplicate = await duplicateQuery.first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este usuario ja possui convite ativo para este evento.'
    );
  }

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', invitedUser)
    .first({ useMasterKey: true });
  if (existingReg) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este usuario ja esta inscrito neste evento.'
    );
  }

  const invitation = new Parse.Object('RefereeInvitation');
  invitation.set('event', event);
  invitation.set('pelada', event.get('pelada'));
  invitation.set('invitedUser', invitedUser);
  invitation.set('invitedBy', user);
  invitation.set('role', requiredRole);
  invitation.set('status', 'pending');
  invitation.set('offeredAmount', offeredAmount);
  invitation.set('responseDeadline', responseDeadline);
  invitation.set('supplementaryKind', kind);
  invitation.set('presenceConfirmed', false);
  invitation.set('paymentConfirmedByAdmin', false);
  invitation.set('paymentConfirmedByReferee', false);
  invitation.set('workCompleted', false);
  invitation.set('paymentReleased', false);
  invitation.set('excusedFault', false);

  if (request.params.invitedUserApelido) {
    invitation.set('invitedUserApelido', String(request.params.invitedUserApelido));
  }
  if (request.params.invitedUserFullName) {
    invitation.set('invitedUserFullName', String(request.params.invitedUserFullName));
  }
  if (request.params.invitedUserAvatarUrl) {
    invitation.set('invitedUserAvatarUrl', String(request.params.invitedUserAvatarUrl));
  }

  const inviterApelido = (user.get('apelido') || '').trim();
  const inviterFullName = (user.get('name') || '').trim();
  if (inviterApelido) invitation.set('invitedByApelido', inviterApelido);
  if (inviterFullName) invitation.set('invitedByFullName', inviterFullName);
  invitation.set(
    'invitedByName',
    inviterApelido || inviterFullName || user.getUsername() || 'Convidante'
  );

  const saved = await invitation.save(null, { useMasterKey: true });
  return { objectId: saved.id };
});

Parse.Cloud.define('completeSupplementaryHiring', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const role = request.params.role === 'scout' ? 'scout' : 'referee';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', role)
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Inscricao nao encontrada neste evento.'
    );
  }

  registration.set('supplementaryHiringCompleted', true);
  await registration.save(null, { useMasterKey: true });
  return { ok: true };
});

Parse.Cloud.define('checkInviteeScheduleConflict', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const invitedUserId = request.params.invitedUserId
    ? String(request.params.invitedUserId)
    : '';
  const excludeEventId = request.params.excludeEventId
    ? String(request.params.excludeEventId)
    : '';
  if (!invitedUserId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'invitedUserId obrigatorio.');
  }

  const startTime = request.params.startTime ? new Date(request.params.startTime) : null;
  const endTime = request.params.endTime ? new Date(request.params.endTime) : null;
  if (
    !startTime ||
    Number.isNaN(startTime.getTime()) ||
    !endTime ||
    Number.isNaN(endTime.getTime())
  ) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe um periodo valido.');
  }

  const includePending = !!request.params.includePending;
  return findUserScheduleConflictDetail(
    invitedUserId,
    startTime,
    endTime,
    excludeEventId,
    { includePending }
  );
});

function timesOverlap(startA, endA, startB, endB) {
  return !!startA && !!endA && !!startB && !!endB && startA < endB && startB < endA;
}

function resolveUserAvatarUrl(user) {
  if (!user || !user.get) return '';
  const direct = String(user.get('avatarUrl') || '').trim();
  if (direct) return direct;
  const file = user.get('avatar');
  if (file && typeof file.url === 'function') {
    try {
      return String(file.url() || '').trim();
    } catch {
      return '';
    }
  }
  if (file && file._url) return String(file._url).trim();
  return '';
}

async function findUserScheduleConflictDetail(
  userId,
  startTime,
  endTime,
  excludeEventId,
  options = {}
) {
  const includePending = !!(options && options.includePending);
  const invitedUser = Parse.User.createWithoutData(userId);
  const statuses = includePending ? ['pending', 'accepted'] : ['accepted'];

  const invitations = await new Parse.Query('RefereeInvitation')
    .equalTo('invitedUser', invitedUser)
    .containedIn('status', statuses)
    .include('event')
    .limit(200)
    .find({ useMasterKey: true });

  for (const invitation of invitations) {
    const event = invitation.get('event');
    if (!event || !event.id || event.id === excludeEventId) continue;
    const otherStart = event.get('startTime');
    const otherEnd = event.get('endTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: invitation.get('status') === 'pending' ? 'pending_invitation' : 'invitation',
        invitationId: invitation.id,
        invitationStatus: invitation.get('status') || '',
        eventId: event.id,
        eventName: event.get('name') || 'Outro evento',
        startTime: otherStart ? otherStart.toISOString() : null,
        endTime: otherEnd ? otherEnd.toISOString() : null,
      };
    }
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('user', invitedUser)
    .include('event')
    .limit(500)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    if (!registration.get('isEffectivelyConfirmed')) continue;
    const event = registration.get('event');
    if (!event || !event.id || event.id === excludeEventId) continue;
    const otherStart = event.get('startTime');
    const otherEnd = event.get('endTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'registration',
        invitationId: null,
        invitationStatus: '',
        eventId: event.id,
        eventName: event.get('name') || 'Outro evento',
        startTime: otherStart ? otherStart.toISOString() : null,
        endTime: otherEnd ? otherEnd.toISOString() : null,
      };
    }
  }

  return { conflict: false };
}

Parse.Cloud.define('getInvitationAcceptConflicts', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const invitationId = String(request.params.invitationId || '').trim();
  if (!invitationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'invitationId obrigatorio.');
  }

  const invitation = await new Parse.Query('RefereeInvitation')
    .include('event')
    .include('invitedUser')
    .get(invitationId, { useMasterKey: true });
  const invited = invitation.get('invitedUser');
  if (!invited || invited.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Este convite nao pertence a voce.');
  }
  const event = invitation.get('event');
  if (!event || !event.id) {
    return { conflicts: [] };
  }
  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  const conflicts = [];

  // Outro lado do mesmo confronto (pending/accepted).
  const sameEventOthers = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invited)
    .containedIn('status', ['pending', 'accepted'])
    .notEqualTo('objectId', invitationId)
    .limit(20)
    .find({ useMasterKey: true });
  for (const other of sameEventOthers) {
    conflicts.push({
      invitationId: other.id,
      invitationStatus: other.get('status') || '',
      source: 'same_event',
      eventId: event.id,
      eventName: event.get('name') || 'Confronto',
      teamSide: other.get('teamSide') || '',
      startTime: startTime ? startTime.toISOString() : null,
      endTime: endTime ? endTime.toISOString() : null,
      canDecline: other.get('status') === 'pending',
      hardBlock: other.get('status') === 'accepted',
    });
  }

  if (startTime && endTime) {
    const schedule = await findUserScheduleConflictDetail(
      invited.id,
      startTime,
      endTime,
      event.id,
      { includePending: true }
    );
    if (schedule && schedule.conflict) {
      const alreadyListed =
        schedule.invitationId &&
        conflicts.some((row) => row.invitationId === schedule.invitationId);
      if (!alreadyListed) {
        conflicts.push({
          invitationId: schedule.invitationId || null,
          invitationStatus: schedule.invitationStatus || '',
          source: schedule.source || 'invitation',
          eventId: schedule.eventId,
          eventName: schedule.eventName,
          teamSide: '',
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          canDecline: schedule.source === 'pending_invitation' && !!schedule.invitationId,
          hardBlock: schedule.source === 'invitation' || schedule.source === 'registration',
        });
      }
    }
  }

  return { conflicts };
});

async function findAmateurTeamScheduleConflict(teamId, startTime, endTime, opts = {}) {
  const excludeEventId = String(opts.excludeEventId || '').trim();
  const excludeChallengeId = String(opts.excludeChallengeId || '').trim();
  const teamPtr = Parse.Object.createWithoutData('AmateurTeam', teamId);

  const homeQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('homeTeam', teamPtr)
    .notEqualTo('isFinished', true);
  const awayQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('awayTeam', teamPtr)
    .notEqualTo('isFinished', true);
  const events = await Parse.Query.or(homeQ, awayQ).limit(100).find({ useMasterKey: true });
  for (const event of events) {
    if (event.id === excludeEventId) continue;
    const otherStart = event.get('startTime');
    const otherEnd = event.get('endTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'team_event',
        eventId: event.id,
        eventName: event.get('name') || 'Outro confronto',
        startTime: otherStart,
        endTime: otherEnd,
        teamId,
      };
    }
  }

  const asChallenger = new Parse.Query('MatchChallenge')
    .equalTo('challengerTeam', teamPtr)
    .containedIn('status', ['pending', 'accepted']);
  const asChallenged = new Parse.Query('MatchChallenge')
    .equalTo('challengedTeam', teamPtr)
    .containedIn('status', ['pending', 'accepted']);
  const challenges = await Parse.Query.or(asChallenger, asChallenged)
    .limit(50)
    .find({ useMasterKey: true });
  for (const challenge of challenges) {
    if (challenge.id === excludeChallengeId) continue;
    const otherStart = challenge.get('proposedStartTime');
    const otherEnd = challenge.get('proposedEndTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'challenge',
        challengeId: challenge.id,
        eventName:
          `${challenge.get('challengerTeamName') || 'Time'} x ${
            challenge.get('challengedTeamName') || 'Adversario'
          }`,
        startTime: otherStart,
        endTime: otherEnd,
        teamId,
      };
    }
  }

  return { conflict: false };
}

async function assertTeamsFreeForProposedMatch(
  challengerTeam,
  challengedTeam,
  startTime,
  endTime,
  opts = {}
) {
  const teams = [challengerTeam, challengedTeam].filter(Boolean);
  for (const team of teams) {
    const teamConflict = await findAmateurTeamScheduleConflict(team.id, startTime, endTime, opts);
    if (teamConflict.conflict) {
      const teamName = team.get('name') || 'Time';
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `${teamName} ja tem compromisso em "${teamConflict.eventName}" neste horario.`
      );
    }
    let president = team.get('president');
    if (president && president.id && !president.get) {
      president = await new Parse.Query(Parse.User).get(president.id, { useMasterKey: true });
    } else if (president && president.id && typeof president.fetch === 'function') {
      try {
        await president.fetch({ useMasterKey: true });
      } catch {
        /* usa pointer */
      }
    }
    if (president && president.id) {
      const userConflict = await findUserScheduleConflictDetail(
        president.id,
        startTime,
        endTime,
        opts.excludeEventId
      );
      if (userConflict.conflict) {
        const teamName = team.get('name') || 'Time';
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          `Presidente de ${teamName} ja tem compromisso em "${userConflict.eventName}" neste horario.`
        );
      }
    }
  }
}

function mapTeamMatchEventRow(event) {
  const homeTeam = event.get('homeTeam');
  const awayTeam = event.get('awayTeam');
  const admin = event.get('admin');
  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  const returnOf = event.get('returnOf');
  const homeShield = homeTeam && homeTeam.get ? homeTeam.get('shieldImage') : null;
  const awayShield = awayTeam && awayTeam.get ? awayTeam.get('shieldImage') : null;
  return {
    objectId: event.id,
    name: event.get('name') || '',
    type: 'team_match',
    startTime: startTime ? startTime.toISOString() : null,
    endTime: endTime ? endTime.toISOString() : null,
    homeTeamId: homeTeam && homeTeam.id ? homeTeam.id : undefined,
    awayTeamId: awayTeam && awayTeam.id ? awayTeam.id : undefined,
    homeTeamName:
      event.get('homeTeamName') || (homeTeam && homeTeam.get ? homeTeam.get('name') : '') || '',
    awayTeamName:
      event.get('awayTeamName') || (awayTeam && awayTeam.get ? awayTeam.get('name') : '') || '',
    homeTeamShieldUrl: homeShield && homeShield.url ? homeShield.url() : undefined,
    awayTeamShieldUrl: awayShield && awayShield.url ? awayShield.url() : undefined,
    adminId: admin && admin.id ? admin.id : '',
    hasReturnLeg: !!event.get('hasReturnLeg'),
    returnOfEventId: returnOf && returnOf.id ? returnOf.id : undefined,
    address: event.get('address') || {},
    locationComplement: event.get('locationComplement') || '',
    isFinished: !!event.get('isFinished'),
    homeAcceptsUninvitedAthletes: !!event.get('homeAcceptsUninvitedAthletes'),
    awayAcceptsUninvitedAthletes: !!event.get('awayAcceptsUninvitedAthletes'),
  };
}

async function loadUserAmateurTeams(user) {
  return new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .limit(20)
    .find({ useMasterKey: true });
}

async function createTeamMatchInvitation(event, invitedUserId, invitedBy, teamSide, deadline, offeredAmount) {
  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  // Duplicata so no mesmo lado — outro time pode convocar o mesmo atleta (ele escolhe).
  const duplicateSameSide = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invitedUser)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (duplicateSameSide) return duplicateSameSide;

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', invitedUser)
    .first({ useMasterKey: true });
  if (existingReg) return null;

  const invitation = new Parse.Object('RefereeInvitation');
  invitation.set('event', event);
  if (event.get('pelada')) invitation.set('pelada', event.get('pelada'));
  invitation.set('invitedUser', invitedUser);
  invitation.set('invitedBy', invitedBy);
  invitation.set('role', 'athlete');
  invitation.set('teamSide', teamSide);
  invitation.set('status', 'pending');
  invitation.set('offeredAmount', Number(offeredAmount || 0));
  invitation.set('responseDeadline', deadline);
  invitation.set('presenceConfirmed', false);
  invitation.set('paymentConfirmedByAdmin', false);
  invitation.set('paymentConfirmedByReferee', false);
  invitation.set('workCompleted', false);
  invitation.set('paymentReleased', false);
  invitation.set('excusedFault', false);
  const inviterApelido = (invitedBy.get('apelido') || '').trim();
  const inviterFullName = (invitedBy.get('name') || '').trim();
  invitation.set('invitedByName', inviterApelido || inviterFullName || invitedBy.getUsername() || 'Mandante');
  if (inviterApelido) invitation.set('invitedByApelido', inviterApelido);
  if (inviterFullName) invitation.set('invitedByFullName', inviterFullName);
  const inviterAvatar = resolveUserAvatarUrl(invitedBy);
  if (inviterAvatar) invitation.set('invitedByAvatarUrl', inviterAvatar);
  await invitation.save(null, { useMasterKey: true });
  return invitation;
}

async function saveTeamMatchEvent(adminUser, payload) {
  if (!adminUser || !adminUser.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Administrador do confronto invalido.');
  }
  const event = new Parse.Object('Event');
  event.set('name', payload.name);
  event.set('type', 'team_match');
  event.set('startTime', payload.startTime);
  event.set('endTime', payload.endTime);
  event.set('address', payload.address || {});
  event.set('locationComplement', payload.locationComplement || '');
  // Admin = presidente do mandante desta perna (ida ou volta).
  event.set('admin', adminUser);
  event.set('readOnlyAt', new Date(payload.endTime.getTime() + 2 * 60 * 60 * 1000));
  event.set('registrationOpensAt', new Date());
  event.set('registrationClosesAt', payload.startTime);
  event.set('useArrivalOrderForTeams', false);
  event.set('participationFee', 0);
  event.set('isFinished', false);
  event.set('homeTeam', payload.homeTeam);
  event.set('awayTeam', payload.awayTeam);
  event.set('homeTeamName', payload.homeTeam.get('name') || payload.name);
  event.set('awayTeamName', payload.awayTeam.get('name') || '');
  event.set('homeAcceptsUninvitedAthletes', false);
  event.set('awayAcceptsUninvitedAthletes', false);
  event.set('athleteConvocationBy', 'president');
  if (payload.hasReturnLeg) event.set('hasReturnLeg', true);
  if (payload.returnOf) event.set('returnOf', payload.returnOf);
  if (payload.challengeConditions) {
    event.set('challengeConditions', String(payload.challengeConditions).trim().slice(0, 2000));
  }
  if (payload.matchChallenge) event.set('matchChallenge', payload.matchChallenge);
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setWriteAccess(adminUser.id, true);
  event.setACL(acl);
  await event.save(null, { useMasterKey: true });
  return event;
}

function teamMatchAddressHasContent(value) {
  if (!value || typeof value !== 'object') return false;
  return ['street', 'neighborhood', 'city', 'state', 'zipCode'].some((key) =>
    String(value[key] || '').trim()
  );
}

Parse.Cloud.define('createTeamMatch', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const challengeId = String(request.params.challengeId || '').trim();
  if (!challengeId) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Aceite um desafio antes de marcar o confronto.'
    );
  }
  const challenge = await new Parse.Query('MatchChallenge')
    .include('challengerTeam')
    .include('challengedTeam')
    .include('challengerUser')
    .get(challengeId, { useMasterKey: true });
  if (challenge.get('status') !== 'accepted') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O desafio precisa estar aceito.');
  }
  const challengerUser = challenge.get('challengerUser');
  if (!challengerUser || challengerUser.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas quem enviou o desafio pode marcar o confronto apos o aceite.'
    );
  }
  if (challenge.get('eventId')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este desafio ja gerou um confronto.');
  }

  const homeTeamId = String(
    request.params.homeTeamId || (challenge.get('challengerTeam') && challenge.get('challengerTeam').id) || ''
  ).trim();
  const awayTeamId = String(
    request.params.awayTeamId || (challenge.get('challengedTeam') && challenge.get('challengedTeam').id) || ''
  ).trim();
  if (!homeTeamId || !awayTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time mandante e o visitante.');
  }
  if (homeTeamId === awayTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Mandante e visitante precisam ser times diferentes.');
  }

  const startTime = request.params.startTime
    ? new Date(request.params.startTime)
    : challenge.get('proposedStartTime')
      ? new Date(challenge.get('proposedStartTime'))
      : null;
  const endTime = request.params.endTime
    ? new Date(request.params.endTime)
    : challenge.get('proposedEndTime')
      ? new Date(challenge.get('proposedEndTime'))
      : null;
  if (!startTime || Number.isNaN(startTime.getTime()) || !endTime || Number.isNaN(endTime.getTime())) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe data e hora do confronto.');
  }
  if (endTime <= startTime) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino deve ser apos o inicio.');
  }

  const homeTeam = await new Parse.Query('AmateurTeam').include('president').get(homeTeamId, {
    useMasterKey: true,
  });
  const awayTeam = await new Parse.Query('AmateurTeam').include('president').get(awayTeamId, {
    useMasterKey: true,
  });
  const homePresident = homeTeam.get('president');
  if (!homePresident || homePresident.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'So o presidente do time mandante pode marcar o confronto.'
    );
  }

  await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, startTime, endTime, {
    excludeChallengeId: challenge.id,
  });

  const homeName = String(homeTeam.get('name') || 'Mandante').trim();
  const awayName = String(awayTeam.get('name') || 'Visitante').trim();
  const name = String(request.params.name || '').trim() || `${homeName} x ${awayName}`;
  const addressFromChallenge =
    challenge.get('proposedAddress') && typeof challenge.get('proposedAddress') === 'object'
      ? challenge.get('proposedAddress')
      : {};
  const address =
    request.params.address && typeof request.params.address === 'object'
      ? request.params.address
      : addressFromChallenge;
  const locationComplement = String(
    request.params.locationComplement || challenge.get('proposedLocationComplement') || ''
  ).trim();

  const athleteInvitesRaw = Array.isArray(request.params.athleteInvites)
    ? request.params.athleteInvites
    : [];
  const athleteInvites = [];
  const seenAthleteIds = new Set();
  for (const row of athleteInvitesRaw) {
    const userId = String((row && row.userId) || '').trim();
    if (!userId || seenAthleteIds.has(userId) || userId === user.id) continue;
    seenAthleteIds.add(userId);
    athleteInvites.push({
      userId,
      offeredAmount: Math.max(0, Number((row && row.offeredAmount) || 0)),
    });
  }
  if (!athleteInvites.length && Array.isArray(request.params.athleteUserIds)) {
    const defaultOffer = Math.max(0, Number(request.params.offeredAmount || 0));
    for (const id of request.params.athleteUserIds) {
      const userId = String(id || '').trim();
      if (!userId || seenAthleteIds.has(userId) || userId === user.id) continue;
      seenAthleteIds.add(userId);
      athleteInvites.push({ userId, offeredAmount: defaultOffer });
    }
  }
  athleteInvites.splice(40);

  const deadlineRaw = request.params.responseDeadline
    ? new Date(request.params.responseDeadline)
    : new Date(Date.now() + 48 * 60 * 60 * 1000);
  const deadline =
    deadlineRaw && !Number.isNaN(deadlineRaw.getTime()) && deadlineRaw > new Date()
      ? deadlineRaw
      : new Date(Date.now() + 2 * 60 * 60 * 1000);

  for (const invite of athleteInvites) {
    const athleteConflict = await findUserScheduleConflictDetail(
      invite.userId,
      startTime,
      endTime,
      ''
    );
    if (athleteConflict.conflict) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `Atleta ja tem compromisso em "${athleteConflict.eventName}" neste horario (ida).`
      );
    }
  }

  let returnStart = null;
  let returnEnd = null;
  let returnAddressForLeg = null;
  let returnComplementForLeg = '';
  const forceReturnLeg = !!challenge.get('hasReturnLeg') || !!request.params.returnLeg;
  if (forceReturnLeg) {
    returnStart = request.params.returnStartTime ? new Date(request.params.returnStartTime) : null;
    returnEnd = request.params.returnEndTime ? new Date(request.params.returnEndTime) : null;
    if (!returnStart || Number.isNaN(returnStart.getTime())) {
      const storedStart = challenge.get('returnStartTime');
      returnStart = storedStart ? new Date(storedStart) : null;
    }
    if (!returnEnd || Number.isNaN(returnEnd.getTime())) {
      const storedEnd = challenge.get('returnEndTime');
      returnEnd = storedEnd ? new Date(storedEnd) : null;
    }
    if (!returnStart || Number.isNaN(returnStart.getTime()) || !returnEnd || Number.isNaN(returnEnd.getTime())) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe data e hora do jogo da volta.');
    }
    const requestedReturnAddress =
      request.params.returnAddress && typeof request.params.returnAddress === 'object'
        ? request.params.returnAddress
        : null;
    const storedReturnAddress = challenge.get('returnAddress');
    returnAddressForLeg = teamMatchAddressHasContent(requestedReturnAddress)
      ? requestedReturnAddress
      : teamMatchAddressHasContent(storedReturnAddress)
        ? storedReturnAddress
        : address;
    const requestedComplement = String(request.params.returnLocationComplement || '').trim();
    returnComplementForLeg = (
      requestedComplement ||
      String(challenge.get('returnLocationComplement') || '').trim() ||
      String(locationComplement || '')
    ).trim();
    if (returnEnd <= returnStart) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino da volta deve ser apos o inicio.');
    }
    await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, returnStart, returnEnd, {
      excludeChallengeId: challenge.id,
    });
    for (const invite of athleteInvites) {
      const athleteConflict = await findUserScheduleConflictDetail(
        invite.userId,
        returnStart,
        returnEnd,
        ''
      );
      if (athleteConflict.conflict) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          `Atleta ja tem compromisso em "${athleteConflict.eventName}" neste horario (volta).`
        );
      }
    }
  }

  const challengeConditions = String(
    request.params.challengeConditions ||
      challenge.get('challengeConditions') ||
      ''
  )
    .trim()
    .slice(0, 2000);
  const returnChallengeConditions = String(
    request.params.returnChallengeConditions ||
      challenge.get('returnChallengeConditions') ||
      challengeConditions
  )
    .trim()
    .slice(0, 2000);

  // Garante campos de avatar do presidente no convite.
  try {
    await user.fetch({ useMasterKey: true });
  } catch {
    /* segue com sessao atual */
  }

  const first = await saveTeamMatchEvent(homePresident, {
    name,
    startTime,
    endTime,
    address,
    locationComplement,
    homeTeam,
    awayTeam,
    hasReturnLeg: forceReturnLeg,
    challengeConditions,
    matchChallenge: challenge,
  });

  let second = null;
  if (forceReturnLeg) {
    const awayPresident = awayTeam.get('president');
    if (!awayPresident || !awayPresident.id) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Time visitante sem presidente para administrar a volta.'
      );
    }
    second = await saveTeamMatchEvent(awayPresident, {
      name: `${awayName} x ${homeName}`,
      startTime: returnStart,
      endTime: returnEnd,
      address: returnAddressForLeg || address,
      locationComplement: returnComplementForLeg,
      homeTeam: awayTeam,
      awayTeam: homeTeam,
      returnOf: first,
      challengeConditions: returnChallengeConditions,
      matchChallenge: challenge,
    });
  }

  challenge.set('eventId', first.id);
  if (second && second.id) challenge.set('returnEventId', second.id);
  challenge.set('status', 'scheduled');
  await challenge.save(null, { useMasterKey: true });

  // Convite por data: ida e, se houver, volta (cada um com seu evento).
  for (const invite of athleteInvites) {
    await createTeamMatchInvitation(
      first,
      invite.userId,
      user,
      'home',
      deadline,
      invite.offeredAmount
    );
    if (second) {
      await createTeamMatchInvitation(
        second,
        invite.userId,
        user,
        'away',
        deadline,
        invite.offeredAmount
      );
    }
  }

  let audienceIds = [];
  try {
    if (typeof collectTeamMatchNotifyUserIds === 'function') {
      audienceIds = await collectTeamMatchNotifyUserIds(first);
    } else {
      const awayPresident = awayTeam.get('president');
      if (awayPresident && awayPresident.id) audienceIds.push(awayPresident.id);
    }
  } catch (error) {
    console.error('collectTeamMatchNotifyUserIds failed', error);
    const awayPresident = awayTeam.get('president');
    if (awayPresident && awayPresident.id) audienceIds = [awayPresident.id];
  }

  let push = { audience: 0, devicesMatched: 0 };
  try {
    push = await notifyTeamMatchStakeholders(first, audienceIds, user.id);
  } catch (error) {
    console.error('notifyTeamMatchStakeholders failed', error);
  }

  // Mesmo publico do push: elenco, presidentes, confirmados e contratados aceitos.
  if (typeof createAppMessages === 'function') {
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(first.get('startTime')) : '';
    await createAppMessages(audienceIds, {
      senderId: user.id,
      kind: 'team_match_created',
      title: `Novo confronto: ${homeName} x ${awayName}`,
      body:
        `O confronto ${homeName} x ${awayName} foi marcado` +
        (dateLabel ? ` para ${dateLabel}.` : '.') +
        ' Abra o confronto para ver os detalhes.',
      relatedClass: 'Event',
      relatedId: first.id,
      actionRoute: `/event/${first.id}`,
    });
  }

  return {
    event: mapTeamMatchEventRow(first),
    returnEvent: second ? mapTeamMatchEventRow(second) : null,
    invitedAthletes: athleteInvites.length,
    push,
  };
});

async function mergeTeamMatchEventsById(byId, eventIds) {
  const missing = [...new Set(eventIds.map((id) => String(id || '').trim()).filter(Boolean))].filter(
    (id) => !byId.has(id)
  );
  if (!missing.length) return;
  const extraQuery = new Parse.Query('Event');
  extraQuery.equalTo('type', 'team_match');
  extraQuery.containedIn('objectId', missing);
  extraQuery.include('homeTeam');
  extraQuery.include('awayTeam');
  extraQuery.limit(100);
  const extraRows = await extraQuery.find({ useMasterKey: true });
  for (const row of extraRows) {
    byId.set(row.id, row);
  }
}

async function attachReturnLegsForTeamMatches(byId) {
  const roots = Array.from(byId.values()).filter((event) => !event.get('returnOf'));
  if (!roots.length) return;
  const returnQuery = new Parse.Query('Event');
  returnQuery.equalTo('type', 'team_match');
  returnQuery.containedIn('returnOf', roots);
  returnQuery.include('homeTeam');
  returnQuery.include('awayTeam');
  returnQuery.limit(100);
  const returnRows = await returnQuery.find({ useMasterKey: true });
  for (const row of returnRows) {
    byId.set(row.id, row);
  }
}

function sortTeamMatchEventsDesc(merged) {
  merged.sort((a, b) => {
    const ta = a.get('startTime') ? a.get('startTime').getTime() : 0;
    const tb = b.get('startTime') ? b.get('startTime').getTime() : 0;
    return tb - ta;
  });
  return merged;
}

Parse.Cloud.define('listMyTeamMatches', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teams = await loadUserAmateurTeams(user);
  const teamPointers = teams.map((team) =>
    Parse.Object.createWithoutData('AmateurTeam', team.id)
  );
  const adminQuery = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('admin', user);
  const queries = [adminQuery];
  if (teamPointers.length) {
    queries.push(
      new Parse.Query('Event').equalTo('type', 'team_match').containedIn('homeTeam', teamPointers)
    );
    queries.push(
      new Parse.Query('Event').equalTo('type', 'team_match').containedIn('awayTeam', teamPointers)
    );
  }
  const query = queries.length === 1 ? adminQuery : Parse.Query.or(...queries);
  query.include('homeTeam');
  query.include('awayTeam');
  query.descending('startTime');
  query.limit(80);
  const rows = await query.find({ useMasterKey: true });
  const byId = new Map();
  for (const row of rows) {
    byId.set(row.id, row);
  }

  const asChallenger = new Parse.Query('MatchChallenge').equalTo('challengerUser', user);
  const asChallenged = new Parse.Query('MatchChallenge').equalTo('challengedUser', user);
  const linkedChallenges = await Parse.Query.or(asChallenger, asChallenged)
    .exists('eventId')
    .limit(80)
    .find({ useMasterKey: true });
  const linkedEventIds = [];
  for (const challenge of linkedChallenges) {
    linkedEventIds.push(String(challenge.get('eventId') || '').trim());
    linkedEventIds.push(String(challenge.get('returnEventId') || '').trim());
  }
  await mergeTeamMatchEventsById(byId, linkedEventIds);
  await attachReturnLegsForTeamMatches(byId);

  return sortTeamMatchEventsDesc(Array.from(byId.values()))
    .slice(0, 80)
    .map(mapTeamMatchEventRow);
});

/** Feed publico de confrontos (todos os usuarios), semelhante a listPeladasForFeed. */
Parse.Cloud.define('listTeamMatchesForFeed', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const query = new Parse.Query('Event');
  query.equalTo('type', 'team_match');
  query.include('homeTeam');
  query.include('awayTeam');
  query.descending('startTime');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapTeamMatchEventRow);
});

/**
 * Desanexa confrontos de pelada e ajusta admin = presidente do mandante.
 * Idempotente; chamada pelo app no feed de confrontos.
 */
Parse.Cloud.define('repairTeamMatchOwnership', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const query = new Parse.Query('Event');
  query.equalTo('type', 'team_match');
  query.include('homeTeam');
  query.include('homeTeam.president');
  query.include('admin');
  query.limit(200);
  const rows = await query.find({ useMasterKey: true });
  let detachedPelada = 0;
  let fixedAdmin = 0;
  for (const event of rows) {
    let dirty = false;
    if (event.get('pelada')) {
      event.unset('pelada');
      dirty = true;
      detachedPelada += 1;
    }
    const homeTeam = event.get('homeTeam');
    let president = homeTeam && homeTeam.get ? homeTeam.get('president') : null;
    if (homeTeam && homeTeam.id && (!president || !president.id)) {
      try {
        const team = await new Parse.Query('AmateurTeam')
          .include('president')
          .get(homeTeam.id, { useMasterKey: true });
        president = team.get('president');
      } catch {
        president = null;
      }
    }
    if (president && president.id) {
      const currentAdmin = event.get('admin');
      if (!currentAdmin || currentAdmin.id !== president.id) {
        event.set('admin', president);
        dirty = true;
        fixedAdmin += 1;
      }
      const acl = new Parse.ACL();
      acl.setPublicReadAccess(true);
      acl.setWriteAccess(president.id, true);
      event.setACL(acl);
      dirty = true;
    }
    if (dirty) {
      await event.save(null, { useMasterKey: true });
    }
  }
  return { scanned: rows.length, detachedPelada, fixedAdmin };
});

Parse.Cloud.define('listTeamMatchInboxNotices', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teams = await loadUserAmateurTeams(user);
  if (!teams.length) return [];
  const teamPointers = teams.map((team) =>
    Parse.Object.createWithoutData('AmateurTeam', team.id)
  );
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const asAway = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .containedIn('awayTeam', teamPointers);
  const asHome = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .containedIn('homeTeam', teamPointers);
  const query = Parse.Query.or(asAway, asHome);
  query.notEqualTo('admin', user);
  query.greaterThan('createdAt', since);
  query.notEqualTo('isFinished', true);
  query.include('homeTeam');
  query.include('awayTeam');
  query.descending('createdAt');
  query.limit(30);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapTeamMatchEventRow);
});

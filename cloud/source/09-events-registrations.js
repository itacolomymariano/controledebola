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
  };
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
  return rows;
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

  return rows;
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

function normalizeEventTeamSplitState(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const athletesPerTeam = Number(raw.athletesPerTeam);
  const teamCount = Number(raw.teamCount);
  const splitMode = String(raw.splitMode || 'manual');
  const randomStrategy = String(raw.randomStrategy || 'default');
  const teamsRaw = raw.teams;

  if (!Array.isArray(teamsRaw) || !athletesPerTeam || !teamCount) {
    return null;
  }

  const teams = teamsRaw
    .map((team) =>
      Array.isArray(team) ? team.map((userId) => String(userId || '')).filter(Boolean) : []
    )
    .slice(0, 8);

  return {
    athletesPerTeam: Math.max(1, Math.min(20, athletesPerTeam)),
    teamCount: Math.max(1, Math.min(8, teamCount)),
    splitMode: splitMode === 'random' ? 'random' : 'manual',
    randomStrategy: ['default', 'marital', 'favoriteTeam', 'neighborhood'].includes(randomStrategy)
      ? randomStrategy
      : 'default',
    teams,
    savedAt: raw.savedAt ? String(raw.savedAt) : undefined,
  };
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

  const payload = {
    athletesPerTeam: Math.max(1, Math.min(20, athletesPerTeam || 1)),
    teamCount: Math.max(1, Math.min(8, teamCount || 1)),
    splitMode: splitMode === 'random' ? 'random' : 'manual',
    randomStrategy: ['default', 'marital', 'favoriteTeam', 'neighborhood'].includes(randomStrategy)
      ? randomStrategy
      : 'default',
    teams,
    savedAt: new Date().toISOString(),
  };

  event.set('teamSplit', payload);
  await event.save(null, { useMasterKey: true });

  return normalizeEventTeamSplitState(payload);
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

  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  const overlaps = (otherStart, otherEnd) =>
    !!otherStart && !!otherEnd && startTime < otherEnd && otherStart < endTime;

  const acceptedInvitations = await new Parse.Query('RefereeInvitation')
    .equalTo('invitedUser', invitedUser)
    .equalTo('status', 'accepted')
    .include('event')
    .limit(200)
    .find({ useMasterKey: true });

  for (const invitation of acceptedInvitations) {
    const event = invitation.get('event');
    if (!event || !event.id || event.id === excludeEventId) continue;
    const otherStart = event.get('startTime');
    const otherEnd = event.get('endTime');
    if (overlaps(otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'invitation',
        eventId: event.id,
        eventName: event.get('name') || 'Outro evento',
        startTime: otherStart,
        endTime: otherEnd,
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
    if (overlaps(otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'registration',
        eventId: event.id,
        eventName: event.get('name') || 'Outro evento',
        startTime: otherStart,
        endTime: otherEnd,
      };
    }
  }

  return { conflict: false };
});

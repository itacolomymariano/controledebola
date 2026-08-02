/** Pelada — socios, participantes e apresentacao de perfil */

// Participantes da pelada
Parse.Cloud.define('listPeladaEventParticipants', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }

  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const admin = pelada.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador da pelada pode listar participantes.'
    );
  }

  const eventQuery = new Parse.Query('Event');
  eventQuery.equalTo('pelada', pelada);
  eventQuery.limit(500);
  const events = await eventQuery.find({ useMasterKey: true });
  if (!events.length) {
    return [];
  }

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.containedIn('event', events);
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });

  const byUser = {};

  for (const row of registrations) {
    const userPtr = row.get('user');
    const userId =
      row.get('participantUserId') || (userPtr && userPtr.id ? userPtr.id : null);
    if (!userId) continue;

    const role = row.get('role') || 'athlete';
    const apelido =
      row.get('apelido') ||
      row.get('userApelido') ||
      '';
    const fullName = row.get('userFullName') || '';
    const displayName =
      apelido ||
      row.get('userDisplayName') ||
      fullName ||
      'Participante';
    const avatarUrl = row.get('avatarUrl') || '';

    if (!byUser[userId]) {
      byUser[userId] = {
        userId,
        userName: displayName,
        apelido: apelido || '',
        fullName: fullName || undefined,
        roles: [role],
        avatarUrl: avatarUrl || undefined,
      };
    } else {
      if (!byUser[userId].roles.includes(role)) {
        byUser[userId].roles.push(role);
      }
      if (!byUser[userId].apelido && apelido) {
        byUser[userId].apelido = apelido;
      }
      if (!byUser[userId].fullName && fullName) {
        byUser[userId].fullName = fullName;
      }
      if (!byUser[userId].avatarUrl && avatarUrl) {
        byUser[userId].avatarUrl = avatarUrl;
      }
    }
  }

  return Object.values(byUser).sort((a, b) =>
    a.userName.localeCompare(b.userName, 'pt-BR')
  );
});

// Socios e exibicao da pelada
function buildMemberDisplay(user, membership) {
  const apelido = membership.get('memberApelido') || user.get('apelido') || '';
  const fullName = membership.get('memberFullName') || user.get('name') || '';
  const displayName =
    membership.get('memberDisplayName') ||
    apelido ||
    fullName ||
    user.getUsername() ||
    'Socio';
  const avatarUrl = membership.get('memberAvatarUrl') || user.get('avatarUrl') || '';

  if (!membership.get('memberDisplayName')) {
    membership.set('memberApelido', apelido);
    membership.set('memberFullName', fullName);
    membership.set('memberDisplayName', displayName);
    if (avatarUrl) membership.set('memberAvatarUrl', avatarUrl);
  }
  if (!membership.get('memberUserId') && user.id) {
    membership.set('memberUserId', user.id);
  }

  return { apelido, fullName, displayName, avatarUrl };
}

/** Resolve e corrige campos de exibicao do admin a partir do ponteiro real. */
async function resolvePeladaAdminDisplay(pelada, { persist = true } = {}) {
  const adminPtr = pelada.get('admin');
  if (!adminPtr || !adminPtr.id) {
    return {
      adminId: '',
      adminApelido: pelada.get('adminApelido') || undefined,
      adminName: pelada.get('adminName') || 'Administrador',
      adminAvatarUrl: pelada.get('adminAvatarUrl') || undefined,
    };
  }

  const admin = await adminPtr.fetch({ useMasterKey: true });
  const apelido = (admin.get('apelido') || '').trim();
  const fullName = (admin.get('name') || '').trim();
  const adminName = apelido || fullName || admin.getUsername() || 'Administrador';
  const adminAvatarUrl = (admin.get('avatarUrl') || '').trim();

  const storedApelido = (pelada.get('adminApelido') || '').trim();
  const storedName = (pelada.get('adminName') || '').trim();
  const storedUserId = (pelada.get('adminUserId') || '').trim();
  const storedAvatar = (pelada.get('adminAvatarUrl') || '').trim();
  const needsHeal =
    storedUserId !== admin.id ||
    storedApelido !== apelido ||
    storedName !== adminName ||
    (adminAvatarUrl && storedAvatar !== adminAvatarUrl);

  if (persist && needsHeal) {
    pelada.set('adminUserId', admin.id);
    pelada.set('adminApelido', apelido);
    pelada.set('adminName', adminName);
    if (adminAvatarUrl) {
      pelada.set('adminAvatarUrl', adminAvatarUrl);
    }
    await pelada.save(null, { useMasterKey: true });
  }

  return {
    adminId: admin.id,
    adminApelido: apelido || undefined,
    adminName,
    adminAvatarUrl: adminAvatarUrl || undefined,
  };
}

Parse.Cloud.define('getPeladaDisplayInfo', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const display = await resolvePeladaAdminDisplay(pelada, { persist: true });
  return {
    adminId: display.adminId || undefined,
    adminApelido: display.adminApelido,
    adminName: display.adminName,
    adminAvatarUrl: display.adminAvatarUrl,
  };
});

/** Lista peladas do feed com admin resolvido via Master Key (evita nome/admin errados por cache desnormalizado). */
Parse.Cloud.define('listPeladasForFeed', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const query = new Parse.Query('Pelada');
  query.limit(100);
  query.ascending('name');
  const results = await query.find({ useMasterKey: true });
  const currentUserId = request.user.id;
  const rows = [];
  const toHeal = [];

  for (const pelada of results) {
    const adminPtr = pelada.get('admin');
    let adminId = String(
      (adminPtr && adminPtr.id ? adminPtr.id : '') || pelada.get('adminUserId') || ''
    ).trim();
    let adminApelido = (pelada.get('adminApelido') || '').trim();
    let adminName = (pelada.get('adminName') || '').trim();
    let adminAvatarUrl = (pelada.get('adminAvatarUrl') || '').trim();

    if (adminPtr && adminPtr.id) {
      adminId = String(adminPtr.id);
      try {
        const admin = await adminPtr.fetch({ useMasterKey: true });
        adminId = String(admin.id || adminId);
        const apelido = (admin.get('apelido') || '').trim();
        const fullName = (admin.get('name') || '').trim();
        const displayName = apelido || fullName || admin.getUsername() || 'Administrador';
        const avatarUrl = (admin.get('avatarUrl') || '').trim();

        const needsHeal =
          String(pelada.get('adminUserId') || '') !== adminId ||
          adminApelido !== apelido ||
          adminName !== displayName ||
          (avatarUrl && adminAvatarUrl !== avatarUrl);

        if (needsHeal) {
          pelada.set('adminUserId', adminId);
          pelada.set('adminApelido', apelido);
          pelada.set('adminName', displayName);
          if (avatarUrl) {
            pelada.set('adminAvatarUrl', avatarUrl);
          }
          toHeal.push(pelada);
        }

        adminApelido = apelido;
        adminName = displayName;
        adminAvatarUrl = avatarUrl || adminAvatarUrl;
      } catch (error) {
        // Mantem ponteiro/adminUserId mesmo se o User nao puder ser lido.
      }
    }

    // Fallback: membership role=admin quando ponteiro/adminUserId estiverem ausentes.
    if (!adminId) {
      try {
        const adminMembership = await new Parse.Query('PeladaMembership')
          .equalTo('pelada', pelada)
          .equalTo('role', 'admin')
          .equalTo('status', 'active')
          .first({ useMasterKey: true });
        const memberUser = adminMembership ? adminMembership.get('user') : null;
        if (memberUser && memberUser.id) {
          adminId = String(memberUser.id);
        }
      } catch {
        // ignora
      }
    }

    const address = pelada.get('address') || {};
    rows.push({
      objectId: pelada.id,
      name: pelada.get('name') || '',
      sport: pelada.get('sport') || 'campo',
      adminId: adminId || '',
      adminName: adminName || adminApelido || 'Administrador',
      adminApelido: adminApelido || undefined,
      adminAvatarUrl: adminAvatarUrl || undefined,
      adminPhotoUrl: pelada.get('adminPhoto') ? pelada.get('adminPhoto').url() : undefined,
      address,
      locationPhotoUrl: pelada.get('locationPhoto')
        ? pelada.get('locationPhoto').url()
        : undefined,
      memberCount: Number(pelada.get('memberCount') || 0),
      foundedAt: pelada.get('foundedAt') || undefined,
      monthlyFee: Number(pelada.get('monthlyFee') || 0),
      socioGoodStandingPaymentExempt: !!pelada.get('socioGoodStandingPaymentExempt'),
      expulsionBanEventCount: Number(pelada.get('expulsionBanEventCount') || 0),
      caixaMembersOnly: pelada.get('caixaMembersOnly') !== false,
      maxSocios: Number(pelada.get('maxSocios') || 0),
      maxAthletesPerEvent: Number(pelada.get('maxAthletesPerEvent') || 0),
      statsConflictSource: pelada.get('statsConflictSource') === 'scout' ? 'scout' : 'referee',
      requireProfilePresentationOnFirstEvent: !!pelada.get(
        'requireProfilePresentationOnFirstEvent'
      ),
      allowTeamSplitAfterEventEnd: !!pelada.get('allowTeamSplitAfterEventEnd'),
      isCurrentUserAdmin: !!adminId && adminId === currentUserId,
    });
  }

  if (toHeal.length) {
    await Parse.Object.saveAll(toHeal, { useMasterKey: true });
  }

  const heldEventCountByPelada = {};
  if (results.length) {
    const eventQuery = new Parse.Query('Event');
    eventQuery.containedIn('pelada', results);
    eventQuery.select(['pelada', 'teamSplit']);
    eventQuery.limit(10000);
    const events = await eventQuery.find({ useMasterKey: true });
    for (const event of events) {
      const peladaPtr = event.get('pelada');
      const peladaId = peladaPtr && peladaPtr.id ? peladaPtr.id : '';
      if (!peladaId) continue;
      // Evento realizado: no minimo houve separacao de times salva.
      if (typeof hasSavedTeamSplit === 'function') {
        if (!hasSavedTeamSplit(event)) continue;
      } else {
        const split = event.get('teamSplit');
        const teams = split && Array.isArray(split.teams) ? split.teams : null;
        if (!teams || !teams.some((team) => Array.isArray(team) && team.length > 0)) {
          continue;
        }
      }
      heldEventCountByPelada[peladaId] = (heldEventCountByPelada[peladaId] || 0) + 1;
    }
  }

  for (const row of rows) {
    row.heldEventCount = heldEventCountByPelada[row.objectId] || 0;
  }

  return rows;
});

Parse.Cloud.define('listPeladaActiveSocios', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const query = new Parse.Query('PeladaMembership');
  query.equalTo('pelada', pelada);
  query.equalTo('status', 'active');
  query.ascending('joinedAt');
  query.limit(500);
  const memberships = await query.find({ useMasterKey: true });

  const rows = [];
  const toSave = [];

  for (const membership of memberships) {
    const user = await membership.get('user').fetch({ useMasterKey: true });
    const display = buildMemberDisplay(user, membership);
    if (!membership.get('memberDisplayName')) {
      toSave.push(membership);
    }

    rows.push({
      membershipId: membership.id,
      userId: membership.get('memberUserId') || user.id,
      displayName: display.displayName,
      userName: display.displayName,
      apelido: display.apelido || undefined,
      fullName: display.fullName || undefined,
      avatarUrl: display.avatarUrl || undefined,
      role: membership.get('role') || 'socio',
      joinedAt: membership.get('joinedAt'),
    });
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
});

const MEMBERSHIP_STATUS_PRIORITY = { active: 3, pending: 2, inactive: 1 };

Parse.Cloud.define('listPeladaMembershipsForAdmin', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const admin = pelada.get('admin');
  if (!admin || admin.id !== request.user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador da pelada pode listar socios.'
    );
  }

  const memberships = await new Parse.Query('PeladaMembership')
    .equalTo('pelada', pelada)
    .limit(1000)
    .find({ useMasterKey: true });

  const byUser = {};
  const toSave = [];

  for (const membership of memberships) {
    const userPtr = membership.get('user');
    if (!userPtr) continue;

    const user = await userPtr.fetch({ useMasterKey: true });
    const userId = membership.get('memberUserId') || user.id;
    if (!userId) continue;

    if (!membership.get('memberUserId')) {
      membership.set('memberUserId', userId);
      toSave.push(membership);
    }

    const display = buildMemberDisplay(user, membership);
    const status = membership.get('status') || 'pending';
    const row = {
      objectId: membership.id,
      userId,
      status,
      role: membership.get('role') || 'socio',
      joinedAt: membership.get('joinedAt'),
      displayName: display.displayName,
      apelido: display.apelido || undefined,
      fullName: display.fullName || undefined,
      avatarUrl: display.avatarUrl || undefined,
    };

    const existing = byUser[userId];
    if (
      !existing ||
      MEMBERSHIP_STATUS_PRIORITY[status] > MEMBERSHIP_STATUS_PRIORITY[existing.status]
    ) {
      byUser[userId] = row;
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  return Object.values(byUser);
});

// Coleta de participantes por escopo
async function collectPeladaPreviousEventParticipantUserIds(peladaId, excludeEventId) {
  const ids = new Set();
  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);

  const eventQuery = new Parse.Query('Event');
  eventQuery.equalTo('pelada', pelada);
  if (excludeEventId) {
    eventQuery.notEqualTo('objectId', String(excludeEventId));
  }
  eventQuery.limit(500);
  const events = await eventQuery.find({ useMasterKey: true });
  if (!events.length) {
    return ids;
  }

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.containedIn('event', events);
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });
  for (const row of registrations) {
    const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
    if (userId) ids.add(String(userId));
  }

  return ids;
}

async function collectPeladaParticipantUserIds(peladaId) {
  const ids = new Set();
  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);

  const byPeladaReg = new Parse.Query('EventRegistration');
  byPeladaReg.equalTo('peladaId', peladaId);
  byPeladaReg.limit(2000);
  const peladaRegs = await byPeladaReg.find({ useMasterKey: true });
  for (const row of peladaRegs) {
    const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
    if (userId) ids.add(String(userId));
  }

  const eventQuery = new Parse.Query('Event');
  eventQuery.equalTo('pelada', pelada);
  eventQuery.limit(500);
  const events = await eventQuery.find({ useMasterKey: true });
  if (events.length) {
    const regQuery = new Parse.Query('EventRegistration');
    regQuery.containedIn('event', events);
    regQuery.limit(2000);
    const registrations = await regQuery.find({ useMasterKey: true });
    for (const row of registrations) {
      const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
      if (userId) ids.add(String(userId));
    }
  }

  const membershipQuery = new Parse.Query('PeladaMembership');
  membershipQuery.equalTo('pelada', pelada);
  membershipQuery.equalTo('status', 'active');
  membershipQuery.limit(2000);
  const memberships = await membershipQuery.find({ useMasterKey: true });
  for (const row of memberships) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) ids.add(String(userPtr.id));
  }

  return ids;
}

async function collectEventParticipantUserIds(eventId) {
  const ids = new Set();
  const event = Parse.Object.extend('Event').createWithoutData(eventId);

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.equalTo('event', event);
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });
  for (const row of registrations) {
    const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
    if (userId) ids.add(String(userId));
  }
  return ids;
}

// Helpers de administracao da pelada
async function assertPeladaAdminUser(peladaId, user) {
  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const admin = pelada.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador da pelada pode realizar esta acao.'
    );
  }
  return pelada;
}

async function getPeladaFromEvent(event) {
  const peladaPtr = event.get('pelada');
  if (!peladaPtr || !peladaPtr.id) {
    return null;
  }
  try {
    return await new Parse.Query('Pelada').get(peladaPtr.id, { useMasterKey: true });
  } catch {
    return null;
  }
}

function registrationCountsAsApprovedParticipation(registration) {
  const status = registration.get('profilePresentationStatus');
  if (status === 'approved') {
    return true;
  }
  if (status === 'pending' || status === 'rejected') {
    return false;
  }
  // Inscricoes antigas (sem status) contam como ja aprovadas.
  return true;
}

async function userHasApprovedPeladaParticipation(peladaId, userId) {
  const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const events = await new Parse.Query('Event')
    .equalTo('pelada', peladaPtr)
    .limit(500)
    .find({ useMasterKey: true });
  if (!events.length) {
    return false;
  }

  const userPtr = Parse.User.createWithoutData(userId);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .containedIn('event', events)
    .limit(500)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    if (registrationCountsAsApprovedParticipation(registration)) {
      return true;
    }
  }
  return false;
}

Parse.Cloud.define('checkProfilePresentationRequired', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const pelada = await getPeladaFromEvent(event);
  if (!pelada || !pelada.get('requireProfilePresentationOnFirstEvent')) {
    return { required: false };
  }

  const hasPrior = await userHasApprovedPeladaParticipation(pelada.id, user.id);
  return { required: !hasPrior };
});

// Revisao de participacao
async function getAppWideAthleteCombinedScore(userId) {
  const performances = await loadMuralPerformanceRows('app');
  let performanceScore = 0;
  for (const perf of performances) {
    const role = perf.get('role');
    if (role !== 'athlete' && role !== 'goalkeeper') continue;
    const perfUserId = getPerformanceParticipantId(perf);
    if (perfUserId !== userId) continue;
    performanceScore += computePerformanceScore(perf);
  }

  const votes = await loadMuralVoteRows('app');
  let total = 0;
  let count = 0;
  for (const vote of votes) {
    if (vote.get('targetRole') !== 'athlete') continue;
    const targetUser = vote.get('targetUser');
    const targetUserId =
      vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '');
    if (targetUserId !== userId) continue;
    total += Number(vote.get('score') || 0);
    count += 1;
  }

  const averageScore = count > 0 ? total / count : 0;
  return performanceScore + averageScore * 10;
}

async function collectRefereeObservationsForUser(userId) {
  const userPtr = Parse.User.createWithoutData(userId);
  const byUser = new Parse.Query('EventPerformance');
  byUser.equalTo('user', userPtr);
  const byParticipant = new Parse.Query('EventPerformance');
  byParticipant.equalTo('participantUserId', userId);
  const performances = await Parse.Query.or(byUser, byParticipant)
    .include('event')
    .include('event.pelada')
    .descending('updatedAt')
    .limit(200)
    .find({ useMasterKey: true });

  const rows = [];
  for (const perf of performances) {
    const observation = String(perf.get('refereeObservation') || '').trim();
    if (!observation) continue;
    const event = perf.get('event');
    const pelada = event && event.get ? event.get('pelada') : null;
    const startTime = event && event.get ? event.get('startTime') : null;
    rows.push({
      eventId: event && event.id ? event.id : '',
      eventName: (event && event.get && event.get('name')) || 'Evento',
      peladaName: pelada && pelada.get ? pelada.get('name') : undefined,
      eventDate: startTime ? startTime.toISOString() : undefined,
      observation,
      yellowCards: Number(perf.get('yellowCards') || 0),
      redCards: Number(perf.get('redCards') || 0),
    });
  }
  return rows;
}

// Apresentacao de perfil na pelada
Parse.Cloud.beforeSave('EventRegistration', async (request) => {
  const registration = request.object;
  if (!registration.isNew()) {
    return;
  }

  const user = registration.get('user');
  const eventPtr = registration.get('event');
  if (!user || !eventPtr || !eventPtr.id) {
    return;
  }

  let event;
  try {
    event = await new Parse.Query('Event')
      .include('pelada')
      .get(eventPtr.id, { useMasterKey: true });
  } catch {
    return;
  }

  const pelada = await getPeladaFromEvent(event);
  if (!pelada || !pelada.get('requireProfilePresentationOnFirstEvent')) {
    return;
  }

  const userId = user.id || user.objectId;
  if (!userId) {
    return;
  }

  if (registration.get('invitedByContract') || registration.get('invitedAsReferee')) {
    return;
  }

  const hasPrior = await userHasApprovedPeladaParticipation(pelada.id, String(userId));
  if (hasPrior) {
    return;
  }

  registration.set('profilePresentationStatus', 'pending');
  registration.set('isEffectivelyConfirmed', false);
});

Parse.Cloud.define('listPeladaProfilePresentationRequests', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const peladaId = String(request.params.peladaId || '').trim();
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }

  await assertPeladaAdminUser(peladaId, user);

  const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const events = await new Parse.Query('Event')
    .equalTo('pelada', peladaPtr)
    .limit(500)
    .find({ useMasterKey: true });
  if (!events.length) {
    return [];
  }

  const registrations = await new Parse.Query('EventRegistration')
    .containedIn('event', events)
    .equalTo('profilePresentationStatus', 'pending')
    .include('user')
    .include('event')
    .descending('createdAt')
    .limit(100)
    .find({ useMasterKey: true });

  return registrations.map((registration) => {
    const event = registration.get('event');
    const startTime = event && event.get ? event.get('startTime') : null;
    return {
      registrationId: registration.id,
      eventId: event && event.id ? event.id : '',
      eventName: (event && event.get && event.get('name')) || 'Evento',
      eventStartTime: startTime ? startTime.toISOString() : undefined,
      userId: String(
        registration.get('participantUserId') ||
          (registration.get('user') && registration.get('user').id) ||
          ''
      ),
      userDisplayName:
        registration.get('userDisplayName') ||
        registration.get('apelido') ||
        'Participante',
      apelido: registration.get('apelido') || '',
      role: registration.get('role') || 'athlete',
      membershipType: registration.get('membershipType') || 'convidado',
      createdAt: registration.get('createdAt')
        ? registration.get('createdAt').toISOString()
        : undefined,
    };
  });
});

Parse.Cloud.define('resolveProfilePresentationRequest', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const peladaId = String(request.params.peladaId || '').trim();
  const registrationId = String(request.params.registrationId || '').trim();
  const action = String(request.params.action || '').trim();
  if (!peladaId || !registrationId || !action) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Parametros invalidos.');
  }
  if (action !== 'approve' && action !== 'reject') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Acao invalida.');
  }

  await assertPeladaAdminUser(peladaId, user);

  const registration = await new Parse.Query('EventRegistration')
    .include('event')
    .include('event.pelada')
    .get(registrationId, { useMasterKey: true });

  const event = registration.get('event');
  const pelada = event && event.get ? event.get('pelada') : null;
  if (!pelada || pelada.id !== peladaId) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada nesta pelada.');
  }

  if (registration.get('profilePresentationStatus') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao ja foi processada.');
  }

  if (action === 'reject') {
    registration.set('profilePresentationStatus', 'rejected');
    registration.set('isEffectivelyConfirmed', false);
    await registration.save(null, { useMasterKey: true });
    await notifyProfilePresentationDecision(registration, event, peladaId, 'rejected');
    return { ok: true, status: 'rejected' };
  }

  registration.set('profilePresentationStatus', 'approved');
  const participationFee = Number(event.get('participationFee') || 0);
  const isEffectivelyConfirmed = computeRegistrationEffectiveConfirmation(
    registration,
    participationFee
  );
  registration.set('isEffectivelyConfirmed', isEffectivelyConfirmed);
  await registration.save(null, { useMasterKey: true });
  await notifyProfilePresentationDecision(registration, event, peladaId, 'approved');
  return { ok: true, status: 'approved' };
});

// Perfil para revisao de participacao
Parse.Cloud.define('getParticipationReviewProfile', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const peladaId = String(request.params.peladaId || '').trim();
  const userId = String(request.params.userId || '').trim();
  if (!peladaId || !userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId e userId obrigatorios.');
  }

  await assertPeladaAdminUser(peladaId, user);

  let targetUser;
  try {
    targetUser = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
  } catch (error) {
    if (error && error.code === Parse.Error.OBJECT_NOT_FOUND) {
      return null;
    }
    throw error;
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.equalTo('user', targetUser);
  const athleteProfile = await athleteQuery.first({ useMasterKey: true });

  const apelido = targetUser.get('apelido') || '';
  const fullName = targetUser.get('name') || '';
  const displayName = apelido || fullName || targetUser.getUsername() || 'Participante';
  const address = targetUser.get('address') || {};
  const birthDate = targetUser.get('birthDate');

  let goals = 0;
  let yellowCards = 0;
  let redCards = 0;
  let appScore = 0;
  const isAthlete = !!athleteProfile;

  if (isAthlete) {
    const perfQuery = new Parse.Query('EventPerformance');
    perfQuery.equalTo('user', targetUser);
    perfQuery.limit(2000);
    const performances = await perfQuery.find({ useMasterKey: true });
    for (const perf of performances) {
      goals += Number(perf.get('goals') || 0);
      yellowCards += Number(perf.get('yellowCards') || 0);
      redCards += Number(perf.get('redCards') || 0);
    }
    appScore = await getAppWideAthleteCombinedScore(userId);
  }

  const sumulaObservations = await collectRefereeObservationsForUser(userId);

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    avatarUrl:
      (athleteProfile && athleteProfile.get('userAvatarUrl')) ||
      targetUser.get('avatarUrl') ||
      undefined,
    state: address.state || undefined,
    city: address.city || undefined,
    neighborhood: address.neighborhood || undefined,
    age: calcAgeFromBirthDate(birthDate),
    phone: targetUser.get('phone') || undefined,
    email: targetUser.get('email') || undefined,
    primaryPosition: athleteProfile ? athleteProfile.get('primaryPosition') || '' : undefined,
    favoriteProTeam: readUserFavoriteProTeam(
      targetUser,
      athleteProfile ? athleteProfile.get('favoriteProTeam') : undefined
    ),
    goals,
    yellowCards,
    redCards,
    appScore,
    isAthlete,
    sumulaObservations,
  };
});

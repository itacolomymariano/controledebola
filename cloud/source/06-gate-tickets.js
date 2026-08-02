/** Controle de portaria e ingressos */

function isEventGateTicketControlEnabled(event) {
  return !!event.get('gateTicketControlEnabled');
}

function generateGateTicketToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function buildGateTicketQrPayload(eventId, registrationId, token) {
  return JSON.stringify({ eventId, registrationId, token, v: 1 });
}

function formatEventLocation(event) {
  const address = event.get('address') || {};
  const parts = [address.street, address.neighborhood, address.city, address.state].filter(Boolean);
  let text = parts.join(', ');
  const complement = String(event.get('locationComplement') || '').trim();
  if (complement) {
    text = text ? `${text} — ${complement}` : complement;
  }
  return text || 'Local a definir';
}

async function resolveGateTicketAdminDisplay(adminUser, event) {
  const admin = adminUser || event.get('admin');
  if (!admin || !admin.id) {
    return { adminId: '', adminName: 'Administrador', adminAvatarUrl: undefined };
  }
  let user = admin;
  if (!admin.get) {
    user = await new Parse.Query(Parse.User).get(admin.id, { useMasterKey: true });
  }
  const adminName =
    (user.get('apelido') || '').trim() ||
    (user.get('name') || '').trim() ||
    user.getUsername() ||
    'Administrador';
  return {
    adminId: user.id,
    adminName,
    adminAvatarUrl:
      resolveStoredAvatarUrl(user, null) ||
      String(event.get('adminAvatarUrl') || '').trim() ||
      undefined,
  };
}

function mapGateTicketResponse(registration, event, adminDisplay) {
  const token = registration.get('gateTicketToken');
  const cancelledAt = registration.get('gateTicketCancelledAt');
  const active = !!token && !cancelledAt;
  return {
    registrationId: registration.id,
    eventId: event.id,
    participantName:
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      registration.get('userApelido') ||
      'Participante',
    participantApelido: registration.get('apelido') || registration.get('userApelido') || '',
    eventName: event.get('name') || 'Evento',
    eventStartTime: event.get('startTime') ? event.get('startTime').toISOString() : '',
    eventEndTime: event.get('endTime') ? event.get('endTime').toISOString() : '',
    eventLocation: formatEventLocation(event),
    authorizedByAdminId: registration.get('gateTicketAuthorizedByAdminId') || adminDisplay.adminId,
    authorizedByAdminName: adminDisplay.adminName,
    authorizedByAdminAvatarUrl: adminDisplay.adminAvatarUrl,
    qrPayload: active ? buildGateTicketQrPayload(event.id, registration.id, token) : '',
    issuedAt: registration.get('gateTicketIssuedAt')
      ? registration.get('gateTicketIssuedAt').toISOString()
      : undefined,
    cancelledAt: cancelledAt ? cancelledAt.toISOString() : undefined,
    entryAt: registration.get('gateTicketEntryAt')
      ? registration.get('gateTicketEntryAt').toISOString()
      : undefined,
    active,
  };
}

async function maybeIssueGateTicketForRegistration(registration, event, adminUser) {
  if (!isEventGateTicketControlEnabled(event)) return registration;
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) return registration;
  if (registration.get('gateTicketToken') && !registration.get('gateTicketCancelledAt')) {
    return registration;
  }
  const adminDisplay = await resolveGateTicketAdminDisplay(adminUser, event);
  registration.set('gateTicketToken', generateGateTicketToken());
  registration.set('gateTicketIssuedAt', new Date());
  registration.unset('gateTicketCancelledAt');
  registration.unset('gateTicketEntryAt');
  if (adminDisplay.adminId) {
    registration.set('gateTicketAuthorizedByAdminId', adminDisplay.adminId);
  }
  await registration.save(null, { useMasterKey: true });
  return registration;
}

async function assertGatekeeperOrEventAdmin(user, eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (admin && admin.id === user.id) {
    return event;
  }
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'gatekeeper')
    .first({ useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);
  if (!registration || !computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas administrador ou porteiro confirmado pode usar este recurso.'
    );
  }
  return event;
}

Parse.Cloud.define('getMyEventGateTicket', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  const event = await new Parse.Query('Event').include('admin').get(eventId, { useMasterKey: true });
  if (!isEventGateTicketControlEnabled(event)) return null;

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (!registration) return null;

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) return null;

  if (!registration.get('gateTicketToken') || registration.get('gateTicketCancelledAt')) {
    await maybeIssueGateTicketForRegistration(registration, event, event.get('admin'));
    await registration.fetch({ useMasterKey: true });
  }
  if (!registration.get('gateTicketToken') || registration.get('gateTicketCancelledAt')) return null;

  const adminDisplay = await resolveGateTicketAdminDisplay(null, event);
  return mapGateTicketResponse(registration, event, adminDisplay);
});

async function handleIssueEventGateTicket(request) {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const registrationId = String(request.params.registrationId || '').trim();
  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId obrigatorios.');
  }
  const event = await assertEventAdmin(user, eventId);
  if (!isEventGateTicketControlEnabled(event)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Controle de ingresso nao esta ativo neste evento.');
  }
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Participante ainda nao esta confirmado para receber ingresso.'
    );
  }
  await maybeIssueGateTicketForRegistration(registration, event, user);
  const adminDisplay = await resolveGateTicketAdminDisplay(user, event);
  return mapGateTicketResponse(registration, event, adminDisplay);
}

Parse.Cloud.define('issueEventGateTicket', handleIssueEventGateTicket);
// Compatibilidade: versao antiga do Cloud Code usava este nome com typo.
Parse.Cloud.define('issueEventGateTickect', handleIssueEventGateTicket);

Parse.Cloud.define('cancelEventGateTicket', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const registrationId = String(request.params.registrationId || '').trim();
  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId obrigatorios.');
  }
  const event = await assertEventAdmin(user, eventId);
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }
  registration.set('gateTicketCancelledAt', new Date());
  registration.unset('gateTicketEntryAt');
  await registration.save(null, { useMasterKey: true });
  const adminDisplay = await resolveGateTicketAdminDisplay(user, event);
  return mapGateTicketResponse(registration, event, adminDisplay);
});

Parse.Cloud.define('validateEventGateTicket', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const qrPayload = String(request.params.qrPayload || '').trim();
  if (!eventId || !qrPayload) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e qrPayload obrigatorios.');
  }
  const event = await assertGatekeeperOrEventAdmin(user, eventId);
  if (!isEventGateTicketControlEnabled(event)) {
    return { valid: false, message: 'Controle de ingresso nao esta ativo neste evento.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(qrPayload);
  } catch {
    return { valid: false, message: 'QR-Code invalido.' };
  }
  if (!parsed || parsed.eventId !== eventId || !parsed.registrationId || !parsed.token) {
    return { valid: false, message: 'Ingresso nao pertence a este evento.' };
  }

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', String(parsed.registrationId))
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!registration) {
    return { valid: false, message: 'Ingresso nao encontrado.' };
  }
  if (registration.get('gateTicketCancelledAt')) {
    return { valid: false, message: 'Ingresso cancelado.' };
  }
  if (String(registration.get('gateTicketToken') || '') !== String(parsed.token)) {
    return { valid: false, message: 'Ingresso invalido.' };
  }

  const now = new Date();
  if (event.get('endTime') && now > event.get('endTime')) {
    return { valid: false, message: 'Ingresso expirado.' };
  }

  const adminDisplay = await resolveGateTicketAdminDisplay(null, event);
  if (registration.get('gateTicketEntryAt')) {
    return {
      valid: true,
      alreadyEntered: true,
      message: 'Participante ja ingressou.',
      participantName: registration.get('userDisplayName') || registration.get('apelido') || 'Participante',
      participantApelido: registration.get('apelido') || '',
      entryAt: registration.get('gateTicketEntryAt').toISOString(),
      authorizedByAdminName: adminDisplay.adminName,
    };
  }

  registration.set('gateTicketEntryAt', now);
  await registration.save(null, { useMasterKey: true });
  return {
    valid: true,
    message: 'Entrada autorizada.',
    participantName: registration.get('userDisplayName') || registration.get('apelido') || 'Participante',
    participantApelido: registration.get('apelido') || '',
    entryAt: now.toISOString(),
    authorizedByAdminName: adminDisplay.adminName,
  };
});

Parse.Cloud.define('listEventGateEntries', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  const event = await assertGatekeeperOrEventAdmin(user, eventId);
  const adminDisplay = await resolveGateTicketAdminDisplay(null, event);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .exists('gateTicketEntryAt')
    .ascending('gateTicketEntryAt')
    .limit(500)
    .find({ useMasterKey: true });

  return registrations.map((registration) => ({
    registrationId: registration.id,
    participantName:
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      registration.get('userApelido') ||
      'Participante',
    participantApelido: registration.get('apelido') || registration.get('userApelido') || '',
    role: registration.get('role') || 'athlete',
    entryAt: registration.get('gateTicketEntryAt').toISOString(),
    authorizedByAdminName: adminDisplay.adminName,
  }));
});

Parse.Cloud.afterSave('EventRegistration', async (request) => {
  const registration = request.object;
  const eventPtr = registration.get('event');
  if (!eventPtr || !eventPtr.id) return;

  let event;
  try {
    event = await new Parse.Query('Event').get(eventPtr.id, { useMasterKey: true });
  } catch {
    return;
  }
  if (!isEventGateTicketControlEnabled(event)) return;

  const participationFee = Number(event.get('participationFee') || 0);
  const wasConfirmed = request.original
    ? computeRegistrationEffectiveConfirmation(request.original, participationFee)
    : false;
  const isConfirmed = computeRegistrationEffectiveConfirmation(registration, participationFee);
  if (!isConfirmed || wasConfirmed) return;
  if (registration.get('gateTicketToken') && !registration.get('gateTicketCancelledAt')) return;

  await maybeIssueGateTicketForRegistration(registration, event, event.get('admin'));
});

// Jobs para executar manualmente em: Cloud Code → Jobs → All Jobs → Run
Parse.Cloud.job('configureMuralClassPermissionsJob', async () => {
  return Parse.Cloud.run('configureMuralClassPermissions', {}, { useMasterKey: true });
});

Parse.Cloud.job('backfillEventMuralVoteSnapshotsJob', async (request) => {
  const eventId = request.params && request.params.eventId ? String(request.params.eventId) : '';
  return Parse.Cloud.run(
    'backfillEventMuralVoteSnapshots',
    eventId ? { eventId } : {},
    { useMasterKey: true }
  );
});

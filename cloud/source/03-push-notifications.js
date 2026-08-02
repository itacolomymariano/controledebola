/** Push notifications, hooks e sync de avatar */

const PUSH_APP_IDENTIFIER = 'com.minhapelada.app';
const FCM_SENDER_ID = '228387546437';
const ANDROID_PUSH_CHANNEL_ID = 'event_messages';

async function sendPushToUser(userId, payload) {
  if (!userId) return;
  // Notificacoes automaticas nao devem quebrar o afterSave.
  await sendPushToUsers([String(userId)], payload, { throwOnError: false });
}

function buildInstallationQueryForUsers(userIds) {
  const userPointers = userIds.map((id) => Parse.User.createWithoutData(id));
  const byUserPointer = new Parse.Query(Parse.Installation);
  byUserPointer.containedIn('user', userPointers);
  byUserPointer.exists('deviceToken');

  // Fallback: algumas instalacoes antigas podem ter so userId textual.
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.containedIn('userId', userIds);
  byUserId.exists('deviceToken');

  return Parse.Query.or(byUserPointer, byUserId);
}

/**
 * Monta payload FCM HTTP v1 para Capacitor.
 * IMPORTANTE: `rawPayload` deve ir no topo do Parse.Push.send (irmão de `where`),
 * nao dentro de `data` — senao o adaptador ignora e a bandeja Android fica vazia.
 */
function buildFcmPushFields(payload) {
  const title = payload.title || 'Controle de Bola';
  const alert = payload.alert || payload.body || title;
  const customData = {
    title,
    alert,
    body: alert,
    // Capacitor / FCM: canal deve bater com PushNotifications.createChannel({ id }).
    android_channel_id: ANDROID_PUSH_CHANNEL_ID,
    channel_id: ANDROID_PUSH_CHANNEL_ID,
  };
  const extra = payload.data || {};
  for (const key of Object.keys(extra)) {
    const value = extra[key];
    if (value == null) continue;
    customData[key] = typeof value === 'string' ? value : String(value);
  }

  const androidNotification = {
    title,
    body: alert,
    // firebase-admin (camelCase) + HTTP v1 REST (snake_case) — Gemini/Firebase.
    channelId: ANDROID_PUSH_CHANNEL_ID,
    channel_id: ANDROID_PUSH_CHANNEL_ID,
    sound: 'default',
  };

  return {
    title,
    alert,
    // Formato documentado pelo parse-server-push-adapter (issue #286).
    rawPayload: {
      notification: {
        title,
        body: alert,
      },
      android: {
        priority: 'high',
        notification: androidNotification,
        data: customData,
      },
      data: customData,
    },
    // Fallback legado (Parse Android SDK / adaptadores antigos).
    data: {
      notification: {
        title,
        body: alert,
      },
      data: customData,
      alert,
      title,
      body: alert,
      sound: 'default',
    },
  };
}

/** Usuarios com pushNotificationsEnabled === false nao recebem push (default: habilitado). */
async function filterUsersAllowingPush(userIds) {
  const ids = [...new Set([...(userIds || [])].map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const denied = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const users = await new Parse.Query(Parse.User)
      .containedIn('objectId', batch)
      .select(['pushNotificationsEnabled'])
      .limit(100)
      .find({ useMasterKey: true });
    for (const row of users) {
      if (row.get('pushNotificationsEnabled') === false) {
        denied.add(row.id);
      }
    }
  }
  return ids.filter((id) => !denied.has(id));
}

async function unlinkAllInstallationsForUser(userId) {
  if (!userId) return 0;
  const byPointer = new Parse.Query(Parse.Installation);
  byPointer.equalTo('user', Parse.User.createWithoutData(userId));
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.equalTo('userId', String(userId));
  const rows = await Parse.Query.or(byPointer, byUserId).limit(100).find({ useMasterKey: true });
  if (!rows.length) return 0;
  for (const row of rows) {
    row.unset('user');
    row.unset('userId');
  }
  await Parse.Object.saveAll(rows, { useMasterKey: true });
  return rows.length;
}

async function sendPushToUsers(userIds, payload, options = {}) {
  const throwOnError = options.throwOnError !== false;
  const idList = await filterUsersAllowingPush(userIds);
  if (!idList.length) {
    return {
      targetedUsers: 0,
      devicesMatched: 0,
      pushBatchesSent: 0,
      matchedUserIds: [],
      matchedInstallationIds: [],
    };
  }

  const { rawPayload, data } = buildFcmPushFields(payload);
  let devicesMatched = 0;
  let pushBatchesSent = 0;
  const matchedUserIds = new Set();
  const matchedInstallationIds = [];

  try {
    for (let i = 0; i < idList.length; i += 100) {
      const batch = idList.slice(i, i + 100);

      // Resolve instalacoes primeiro — Query.or direto no Push.send e instavel no Back4App.
      const installations = await buildInstallationQueryForUsers(batch)
        .limit(1000)
        .find({ useMasterKey: true });
      if (!installations.length) continue;

      const installationIds = [...new Set(installations.map((row) => row.id).filter(Boolean))];
      devicesMatched += installationIds.length;
      matchedInstallationIds.push(...installationIds);

      for (const row of installations) {
        const linked =
          (row.get('user') && row.get('user').id) ||
          row.get('userId') ||
          '';
        if (linked) matchedUserIds.add(String(linked));
      }

      const whereQuery = new Parse.Query(Parse.Installation);
      whereQuery.containedIn('objectId', installationIds);
      // rawPayload no TOPO (nao dentro de data) — exigido pelo adaptador FCM v1.
      await Parse.Push.send({ where: whereQuery, rawPayload, data }, { useMasterKey: true });
      pushBatchesSent += 1;
    }
  } catch (error) {
    console.error('sendPushToUsers failed', error);
    if (throwOnError) throw error;
    return {
      targetedUsers: idList.length,
      devicesMatched,
      pushBatchesSent,
      matchedUserIds: [...matchedUserIds],
      matchedInstallationIds,
    };
  }

  return {
    targetedUsers: idList.length,
    devicesMatched,
    pushBatchesSent,
    matchedUserIds: [...matchedUserIds],
    matchedInstallationIds,
  };
}

function formatEventPushDate(startTime) {
  if (!startTime) return '';
  const date = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function notifyNewPeladaEvent(event) {
  const peladaPtr = event.get('pelada');
  if (!peladaPtr || !peladaPtr.id) return;

  const peladaId = peladaPtr.id;
  const eventId = event.id;
  const participantIds = await collectPeladaPreviousEventParticipantUserIds(peladaId, eventId);
  if (!participantIds.size) return;

  const admin = event.get('admin');
  if (admin && admin.id) {
    participantIds.delete(String(admin.id));
  }
  if (!participantIds.size) return;

  let peladaName = 'pelada';
  try {
    const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
    peladaName = pelada.get('name') || peladaName;
  } catch {
    // Mantem nome padrao se a pelada nao for encontrada.
  }

  const eventName = event.get('name') || 'Novo evento';
  const dateLabel = formatEventPushDate(event.get('startTime'));
  const alert = dateLabel
    ? `Novo evento "${eventName}" em ${peladaName} em ${dateLabel}.`
    : `Novo evento "${eventName}" em ${peladaName}.`;

  await sendPushToUsers(
    participantIds,
    {
      title: 'Novo evento na pelada',
      alert,
      data: {
        type: 'new_pelada_event',
        peladaId,
        eventId,
      },
    },
    { throwOnError: false }
  );
}

async function notifyProfilePresentationDecision(registration, event, peladaId, decision) {
  const participantUserId = String(
    registration.get('participantUserId') ||
      (registration.get('user') && registration.get('user').id) ||
      ''
  );
  if (!participantUserId) return;

  const eventName = (event && event.get && event.get('name')) || 'evento';
  if (decision === 'approved') {
    await sendPushToUser(participantUserId, {
      title: 'Participacao aprovada',
      alert: `Sua participacao no evento "${eventName}" foi aprovada.`,
      data: {
        type: 'profile_presentation_approved',
        eventId: event.id,
        peladaId,
        registrationId: registration.id,
      },
    });
    return;
  }

  await sendPushToUser(participantUserId, {
    title: 'Participacao recusada',
    alert: `Sua solicitacao no evento "${eventName}" foi recusada.`,
    data: {
      type: 'profile_presentation_rejected',
      eventId: event.id,
      peladaId,
      registrationId: registration.id,
    },
  });
}

Parse.Cloud.afterSave('Event', async (request) => {
  if (!request.object.isNew()) return;
  try {
    await notifyNewPeladaEvent(request.object);
  } catch (error) {
    console.error('notifyNewPeladaEvent failed', error);
  }
});

Parse.Cloud.afterSave('Event', async (request) => {
  const event = request.object;
  const wasEnabled = request.original ? !!request.original.get('gateTicketControlEnabled') : false;
  const isEnabled = !!event.get('gateTicketControlEnabled');
  if (!isEnabled || wasEnabled) return;

  const admin = event.get('admin');
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
    await maybeIssueGateTicketForRegistration(registration, event, admin);
  }
});

Parse.Cloud.afterSave('EventRegistration', async (request) => {
  const registration = request.object;
  if (registration.get('profilePresentationStatus') !== 'pending') return;
  if (request.original && request.original.get('profilePresentationStatus') === 'pending') return;

  const eventPtr = registration.get('event');
  if (!eventPtr || !eventPtr.id) return;

  let event;
  try {
    event = await new Parse.Query('Event').include('pelada').get(eventPtr.id, { useMasterKey: true });
  } catch {
    return;
  }

  const pelada = await getPeladaFromEvent(event);
  if (!pelada || !pelada.id) return;
  const admin = pelada.get('admin');
  if (!admin || !admin.id) return;

  const participantName =
    registration.get('userDisplayName') || registration.get('apelido') || 'Participante';
  const eventName = event.get('name') || 'evento';

  await sendPushToUser(admin.id, {
    title: 'Nova solicitacao de participacao',
    alert: `${participantName} pediu para participar do evento "${eventName}".`,
    data: {
      type: 'profile_presentation_request',
      peladaId: pelada.id,
      eventId: event.id,
      registrationId: registration.id,
    },
  });
});

/** Confirmados efetivos de um evento (para lembrete / remarcacao / cancelamento). */
async function collectConfirmedParticipantUserIdsForEvent(event) {
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });
  const userIds = [];
  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      userIds.push(String(resolved.userId));
    }
  }
  return [...new Set(userIds)];
}

const RESCHEDULE_MIN_DELTA_MS = 15 * 60 * 1000;
const REMINDER_2H_WINDOW_BEFORE_MS = 2 * 60 * 60 * 1000;
const REMINDER_2H_TOLERANCE_MS = 10 * 60 * 1000;

async function notifyEventScheduleOrCancelChange(event, original) {
  if (!original) return;

  const wasFinished = !!original.get('isFinished');
  const isFinished = !!event.get('isFinished');
  const oldStart = original.get('startTime');
  const newStart = event.get('startTime');
  const oldStartMs = oldStart instanceof Date ? oldStart.getTime() : new Date(oldStart || 0).getTime();
  const newStartMs = newStart instanceof Date ? newStart.getTime() : new Date(newStart || 0).getTime();
  const now = Date.now();
  const finishChanged = !wasFinished && isFinished;
  const startChanged =
    !Number.isNaN(oldStartMs) &&
    !Number.isNaN(newStartMs) &&
    Math.abs(newStartMs - oldStartMs) >= RESCHEDULE_MIN_DELTA_MS;

  // Ignora saves auxiliares (ex.: limpar pushReminder2hSentAt) sem mudanca de agenda.
  if (!finishChanged && !startChanged) return;

  const confirmedIds = await collectConfirmedParticipantUserIdsForEvent(event);
  if (!confirmedIds.length) {
    if (startChanged && event.get('pushReminder2hSentAt')) {
      event.unset('pushReminder2hSentAt');
      await event.save(null, { useMasterKey: true });
    }
    return;
  }

  const eventName = event.get('name') || 'evento';
  const eventId = event.id;
  const peladaPtr = event.get('pelada');
  const peladaId = peladaPtr && peladaPtr.id ? peladaPtr.id : '';

  // Cancelamento antecipado: marcado como encerrado antes do horario de inicio.
  if (finishChanged && newStartMs && newStartMs > now) {
    await sendPushToUsers(
      confirmedIds,
      {
        title: 'Evento cancelado',
        alert: `O evento "${eventName}" foi cancelado.`,
        data: {
          type: 'event_cancelled',
          eventId,
          peladaId,
        },
      },
      { throwOnError: false }
    );
    return;
  }

  if (startChanged) {
    const dateLabel = formatEventPushDate(newStart);
    const alert = dateLabel
      ? `O evento "${eventName}" foi remarcado para ${dateLabel}.`
      : `O evento "${eventName}" teve o horario alterado.`;

    await sendPushToUsers(
      confirmedIds,
      {
        title: 'Evento remarcado',
        alert,
        data: {
          type: 'event_rescheduled',
          eventId,
          peladaId,
        },
      },
      { throwOnError: false }
    );

    // Permite novo lembrete 2h apos remarcacao.
    if (event.get('pushReminder2hSentAt')) {
      event.unset('pushReminder2hSentAt');
      await event.save(null, { useMasterKey: true });
    }
  }
}

Parse.Cloud.afterSave('Event', async (request) => {
  if (request.object.isNew()) return;
  try {
    await notifyEventScheduleOrCancelChange(request.object, request.original);
  } catch (error) {
    console.error('notifyEventScheduleOrCancelChange failed', error);
  }
});

function hiringRoleLabel(role) {
  const map = {
    referee: 'juiz',
    scout: 'scout/mesario',
    journalist: 'jornalista',
    cameraman: 'cinegrafista',
    narrator: 'narrador',
    coach: 'treinador',
    physical_trainer: 'preparador fisico',
    masseur: 'massagista',
    kitman: 'roupeiro',
    gandula: 'gandula',
    gatekeeper: 'porteiro',
    athlete: 'atleta',
    fan: 'torcedor',
  };
  return map[String(role || '')] || 'profissional';
}

Parse.Cloud.afterSave('RefereeInvitation', async (request) => {
  try {
    const invitation = request.object;
    const original = request.original;
    const status = String(invitation.get('status') || '');
    const invitedUser = invitation.get('invitedUser');
    const invitedBy = invitation.get('invitedBy');
    const eventPtr = invitation.get('event');
    const peladaPtr = invitation.get('pelada');
    const eventId = eventPtr && eventPtr.id ? eventPtr.id : '';
    const peladaId = peladaPtr && peladaPtr.id ? peladaPtr.id : '';
    const roleLabel = hiringRoleLabel(invitation.get('role'));

    let eventName = 'evento';
    if (eventId) {
      try {
        const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
        eventName = event.get('name') || eventName;
      } catch {
        // mantem padrao
      }
    }

    // Novo convite pendente → profissional.
    if (!original) {
      if (status === 'pending' && invitedUser && invitedUser.id) {
        await sendPushToUser(invitedUser.id, {
          title: 'Novo convite de contratacao',
          alert: `Voce foi convidado como ${roleLabel} para "${eventName}".`,
          data: {
            type: 'hiring_invite',
            eventId,
            peladaId,
            invitationId: invitation.id,
          },
        });
      }
      return;
    }

    const prevStatus = String(original.get('status') || '');
    if (prevStatus !== 'pending') return;
    if (status !== 'accepted' && status !== 'declined') return;
    if (!invitedBy || !invitedBy.id) return;

    const inviteeName =
      invitation.get('invitedUserApelido') ||
      invitation.get('invitedUserFullName') ||
      'O profissional';
    const decisionLabel = status === 'accepted' ? 'aceitou' : 'recusou';

    await sendPushToUser(invitedBy.id, {
      title: 'Resposta ao convite',
      alert: `${inviteeName} ${decisionLabel} o convite de ${roleLabel} em "${eventName}".`,
      data: {
        type: 'hiring_response',
        eventId,
        peladaId,
        invitationId: invitation.id,
        decision: status,
      },
    });
  } catch (error) {
    console.error('RefereeInvitation push failed', error);
  }
});

async function runEventRemindersTwoHoursInternal() {
  const now = Date.now();
  const windowStart = new Date(now + REMINDER_2H_WINDOW_BEFORE_MS - REMINDER_2H_TOLERANCE_MS);
  const windowEnd = new Date(now + REMINDER_2H_WINDOW_BEFORE_MS + REMINDER_2H_TOLERANCE_MS);

  const query = new Parse.Query('Event');
  query.greaterThanOrEqualTo('startTime', windowStart);
  query.lessThanOrEqualTo('startTime', windowEnd);
  query.notEqualTo('isFinished', true);
  query.doesNotExist('pushReminder2hSentAt');
  query.limit(100);
  const events = await query.find({ useMasterKey: true });

  let eventsNotified = 0;
  let devicesMatched = 0;

  for (const event of events) {
    const confirmedIds = await collectConfirmedParticipantUserIdsForEvent(event);
    if (!confirmedIds.length) {
      event.set('pushReminder2hSentAt', new Date());
      await event.save(null, { useMasterKey: true });
      continue;
    }

    const eventName = event.get('name') || 'evento';
    const dateLabel = formatEventPushDate(event.get('startTime'));
    const alert = dateLabel
      ? `Faltam cerca de 2 horas para "${eventName}" (${dateLabel}).`
      : `Faltam cerca de 2 horas para "${eventName}".`;
    const peladaPtr = event.get('pelada');

    const pushResult = await sendPushToUsers(
      confirmedIds,
      {
        title: 'Lembrete de pelada',
        alert,
        data: {
          type: 'event_reminder_2h',
          eventId: event.id,
          peladaId: peladaPtr && peladaPtr.id ? peladaPtr.id : '',
        },
      },
      { throwOnError: false }
    );

    event.set('pushReminder2hSentAt', new Date());
    await event.save(null, { useMasterKey: true });

    eventsNotified += 1;
    devicesMatched += pushResult.devicesMatched || 0;
  }

  return {
    ok: true,
    scanned: events.length,
    eventsNotified,
    devicesMatched,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

Parse.Cloud.define('runEventRemindersTwoHours', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }
  return runEventRemindersTwoHoursInternal();
});

Parse.Cloud.job('sendEventRemindersTwoHoursJob', async () => {
  return runEventRemindersTwoHoursInternal();
});

Parse.Cloud.define('setPushNotificationsEnabled', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const enabled = !!request.params.enabled;
  user.set('pushNotificationsEnabled', enabled);
  await user.save(null, { useMasterKey: true });

  let unlinkedInstallations = 0;
  if (!enabled) {
    unlinkedInstallations = await unlinkAllInstallationsForUser(user.id);
  }

  return { ok: true, enabled, unlinkedInstallations };
});

Parse.Cloud.define('getPushNotificationsEnabled', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  await user.fetch({ useMasterKey: true });
  const enabled = user.get('pushNotificationsEnabled') !== false;
  return { ok: true, enabled };
});

Parse.Cloud.define('registerPushDevice', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  await user.fetch({ useMasterKey: true });
  if (user.get('pushNotificationsEnabled') === false) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Notificacoes desativadas pelo usuario. Ative no menu do app.'
    );
  }

  const deviceToken = String(request.params.deviceToken || '').trim();
  const deviceType = String(request.params.deviceType || 'android').trim();
  const deviceModel = String(request.params.deviceModel || '').trim().slice(0, 80);
  const deviceLabel = String(request.params.deviceLabel || '').trim().slice(0, 120);
  if (!deviceToken) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'deviceToken obrigatorio.');
  }

  let installation = await new Parse.Query(Parse.Installation)
    .equalTo('deviceToken', deviceToken)
    .first({ useMasterKey: true });

  if (!installation) {
    installation = new Parse.Installation();
    installation.set('deviceToken', deviceToken);
  }

  const normalizedType = deviceType === 'ios' ? 'ios' : 'android';
  installation.set('deviceType', normalizedType);
  installation.set('user', user);
  installation.set('userId', user.id);
  installation.set('appIdentifier', PUSH_APP_IDENTIFIER);
  installation.set('appName', 'Controle de Bola');
  installation.set('GCMSenderId', FCM_SENDER_ID);
  if (deviceModel) {
    installation.set('deviceModel', deviceModel);
  }
  if (deviceLabel) {
    installation.set('deviceLabel', deviceLabel);
  }
  // Obrigatorio para o adaptador FCM/GCM do Parse/Back4App entregar no Android.
  if (normalizedType === 'android') {
    installation.set('pushType', 'gcm');
  } else {
    installation.unset('pushType');
  }
  await installation.save(null, { useMasterKey: true });

  // Remove Installations antigas do mesmo usuario (tokens mortos geram falso "N aparelhos").
  const pruned = await pruneOtherInstallationsForUser(user.id, installation.id);

  return {
    ok: true,
    installationId: installation.id,
    deviceTokenPrefix: deviceToken.slice(0, 12),
    prunedOldInstallations: pruned,
  };
});

async function pruneOtherInstallationsForUser(userId, keepInstallationId) {
  if (!userId) return 0;
  const byPointer = new Parse.Query(Parse.Installation);
  byPointer.equalTo('user', Parse.User.createWithoutData(userId));
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.equalTo('userId', String(userId));
  const rows = await Parse.Query.or(byPointer, byUserId).limit(100).find({ useMasterKey: true });
  const toDelete = rows.filter((row) => row.id !== keepInstallationId);
  if (!toDelete.length) return 0;
  await Parse.Object.destroyAll(toDelete, { useMasterKey: true });
  return toDelete.length;
}

/** Limpa Installations antigas de um usuario, mantendo so a mais recente. */
Parse.Cloud.define('pruneStalePushInstallationsForUser', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }

  const userId = String(request.params.userId || (request.user && request.user.id) || '').trim();
  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId obrigatorio.');
  }
  if (request.user && !request.master && request.user.id !== userId) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'So pode limpar as proprias instalacoes.');
  }

  const byPointer = new Parse.Query(Parse.Installation);
  byPointer.equalTo('user', Parse.User.createWithoutData(userId));
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.equalTo('userId', userId);
  const rows = await Parse.Query.or(byPointer, byUserId)
    .descending('updatedAt')
    .limit(100)
    .find({ useMasterKey: true });

  if (!rows.length) {
    return { ok: true, kept: null, deleted: 0 };
  }

  const keep = rows[0];
  const deleted = await pruneOtherInstallationsForUser(userId, keep.id);
  return {
    ok: true,
    kept: {
      objectId: keep.id,
      deviceTokenPrefix: String(keep.get('deviceToken') || '').slice(0, 12),
      updatedAt: keep.updatedAt ? keep.updatedAt.toISOString() : null,
    },
    deleted,
  };
});

Parse.Cloud.define('unregisterPushDevice', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const deviceToken = String(request.params.deviceToken || '').trim();
  if (!deviceToken) {
    return { ok: true };
  }

  const installation = await new Parse.Query(Parse.Installation)
    .equalTo('deviceToken', deviceToken)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (installation) {
    installation.unset('user');
    await installation.save(null, { useMasterKey: true });
  }

  return { ok: true };
});

async function assertCanNotifyEventParticipants(user, event) {
  const admin = event.get('admin');
  if (admin && admin.id === user.id) {
    return;
  }

  const peladaPtr = event.get('pelada');
  if (peladaPtr && peladaPtr.id) {
    try {
      const pelada = await new Parse.Query('Pelada').get(peladaPtr.id, { useMasterKey: true });
      const peladaAdmin = pelada.get('admin');
      if (peladaAdmin && peladaAdmin.id === user.id) {
        return;
      }
    } catch {
      // segue para erro abaixo
    }
  }

  throw new Parse.Error(
    Parse.Error.OPERATION_FORBIDDEN,
    'Apenas o administrador do evento ou da pelada pode enviar esta notificacao.'
  );
}

Parse.Cloud.define('sendEventConfirmedParticipantNotification', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = String(request.params.title || '').trim().slice(0, 120);
  const alert = String(request.params.message || request.params.alert || '').trim().slice(0, 500);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Titulo da notificacao obrigatorio.');
  }
  if (!alert) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Mensagem da notificacao obrigatoria.');
  }

  const event = await new Parse.Query('Event').include('pelada').get(eventId, { useMasterKey: true });
  await assertCanNotifyEventParticipants(user, event);

  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });

  const userIds = [];
  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      userIds.push(String(resolved.userId));
    }
  }

  // Inclui o remetente se ele tambem for participante confirmado (ex.: admin testando no proprio aparelho).
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) {
    return { ok: true, targetedUsers: 0, devicesMatched: 0, pushBatchesSent: 0 };
  }

  const pushResult = await sendPushToUsers(
    uniqueUserIds,
    {
      title,
      alert,
      data: {
        type: 'event_admin_message',
        eventId,
      },
    },
    { throwOnError: true }
  );

  const focusEmail = String(request.params.focusEmail || '')
    .trim()
    .toLowerCase();
  const focusUserId = String(request.params.focusUserId || '').trim();
  let focus = null;
  if (focusEmail) {
    focus = await buildPushFocusReport(focusEmail, uniqueUserIds);
  } else if (focusUserId) {
    const installations = await buildInstallationQueryForUsers([focusUserId])
      .limit(50)
      .find({ useMasterKey: true });
    focus = {
      userId: focusUserId,
      found: true,
      confirmed: uniqueUserIds.includes(focusUserId),
      hasInstallation: installations.length > 0,
      inMatchedDevices: (pushResult.matchedUserIds || []).includes(focusUserId),
      installations: mapInstallationDiagnostics(installations),
    };
  }

  if (focus && focus.userId) {
    focus.inMatchedDevices = (pushResult.matchedUserIds || []).includes(String(focus.userId));
  }

  return {
    ok: true,
    targetedUsers: pushResult.targetedUsers,
    devicesMatched: pushResult.devicesMatched,
    pushBatchesSent: pushResult.pushBatchesSent,
    senderIncluded: uniqueUserIds.includes(user.id),
    focus,
  };
});

async function findUserByEmailOrPhone(email, phoneRaw) {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const phone =
    typeof normalizePhoneForStorage === 'function'
      ? normalizePhoneForStorage(phoneRaw)
      : digitsOnly(phoneRaw);

  let foundUser = null;
  if (normalizedEmail) {
    foundUser = await new Parse.Query(Parse.User)
      .equalTo('email', normalizedEmail)
      .first({ useMasterKey: true });
    if (!foundUser) {
      foundUser = await new Parse.Query(Parse.User)
        .equalTo('username', normalizedEmail)
        .first({ useMasterKey: true });
    }
  }
  if (!foundUser && phone.length >= 10) {
    foundUser = await new Parse.Query(Parse.User)
      .equalTo('phone', phone)
      .first({ useMasterKey: true });
    if (!foundUser) {
      const variants = phoneVariants(phone);
      if (variants.length) {
        foundUser = await new Parse.Query(Parse.User)
          .containedIn('phone', variants)
          .first({ useMasterKey: true });
      }
    }
  }
  return foundUser;
}

function mapInstallationDiagnostics(installations, options = {}) {
  const includeFullToken = !!options.includeFullToken;
  return installations.map((row) => {
    const token = String(row.get('deviceToken') || '');
    return {
      objectId: row.id,
      deviceType: row.get('deviceType') || null,
      deviceModel: row.get('deviceModel') || null,
      deviceLabel: row.get('deviceLabel') || null,
      pushType: row.get('pushType') || null,
      GCMSenderId: row.get('GCMSenderId') || null,
      appIdentifier: row.get('appIdentifier') || null,
      userId: row.get('userId') || (row.get('user') && row.get('user').id) || null,
      hasDeviceToken: !!token,
      deviceTokenPrefix: token.slice(0, 12),
      // Token completo so com Master Key — para teste no Firebase Console (Engage > Messaging).
      deviceToken: includeFullToken ? token || null : undefined,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
  });
}

async function buildPushFocusReport(email, confirmedUserIds) {
  const foundUser = await findUserByEmailOrPhone(email, '');
  if (!foundUser) {
    return {
      email,
      found: false,
      confirmed: false,
      hasInstallation: false,
      installations: [],
    };
  }
  const installations = await buildInstallationQueryForUsers([foundUser.id])
    .limit(50)
    .find({ useMasterKey: true });
  return {
    email,
    found: true,
    userId: foundUser.id,
    confirmed: confirmedUserIds.includes(foundUser.id),
    hasInstallation: installations.length > 0,
    inMatchedDevices: null,
    installations: mapInstallationDiagnostics(installations),
  };
}

/** Diagnostico: localiza usuario por e-mail/telefone e lista Installations com token. */
Parse.Cloud.define('diagnosePushForContact', async (request) => {
  if (!request.user && !request.master) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }

  const email = String(request.params.email || '')
    .trim()
    .toLowerCase();
  const phoneRaw = String(request.params.phone || '').trim();
  const phone =
    typeof normalizePhoneForStorage === 'function'
      ? normalizePhoneForStorage(phoneRaw)
      : digitsOnly(phoneRaw);

  if (!email && phone.length < 10) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe email ou telefone.');
  }

  const foundUser = await findUserByEmailOrPhone(email, phoneRaw);
  if (!foundUser) {
    return { ok: true, found: false, user: null, installations: [] };
  }

  const installations = await buildInstallationQueryForUsers([foundUser.id])
    .limit(50)
    .find({ useMasterKey: true });

  // Token completo apenas com Master Key (teste Firebase Console).
  const includeFullToken = !!request.master;

  return {
    ok: true,
    found: true,
    fcmSenderId: FCM_SENDER_ID,
    androidChannelId: ANDROID_PUSH_CHANNEL_ID,
    user: {
      objectId: foundUser.id,
      email: foundUser.get('email') || null,
      username: foundUser.get('username') || null,
      phone: foundUser.get('phone') || null,
    },
    installations: mapInstallationDiagnostics(installations, { includeFullToken }),
    firebaseTestHint:
      'Firebase Console > Engage > Messaging > Send test message — cole deviceToken do Motorola.',
  };
});

/**
 * Diagnostico do envio por evento: confirma se um e-mail esta na lista de confirmados
 * e se tem Installation (token) ligada — util quando "N aparelhos" nao inclui o alvo real.
 */
Parse.Cloud.define('diagnoseEventPushTargets', async (request) => {
  const user = request.user;
  if (!user && !request.master) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const focusEmail = String(request.params.email || request.params.focusEmail || '')
    .trim()
    .toLowerCase();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').include('pelada').get(eventId, { useMasterKey: true });
  if (user) {
    await assertCanNotifyEventParticipants(user, event);
  }

  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });

  const uniqueUserIds = [];
  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      uniqueUserIds.push(String(resolved.userId));
    }
  }
  const confirmedUserIds = [...new Set(uniqueUserIds)];
  const installations = confirmedUserIds.length
    ? await buildInstallationQueryForUsers(confirmedUserIds).limit(1000).find({ useMasterKey: true })
    : [];

  const focus = focusEmail ? await buildPushFocusReport(focusEmail, confirmedUserIds) : null;

  return {
    ok: true,
    eventId,
    confirmedUsers: confirmedUserIds.length,
    devicesMatched: installations.length,
    focus,
  };
});

/** Envia push de teste para o usuario logado (valida FCM + Installation). */
Parse.Cloud.define('sendTestPushToSelf', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pushResult = await sendPushToUsers(
    [user.id],
    {
      title: 'Teste de notificacao',
      alert: 'Se voce leu isto, o Push esta funcionando neste aparelho.',
      data: {
        type: 'push_self_test',
      },
    },
    { throwOnError: true }
  );

  return {
    ok: true,
    userId: user.id,
    targetedUsers: pushResult.targetedUsers,
    devicesMatched: pushResult.devicesMatched,
    pushBatchesSent: pushResult.pushBatchesSent,
  };
});

/** Repara instalacoes Android sem pushType=gcm (necessario para entrega FCM via Back4App). */
Parse.Cloud.define('backfillAndroidPushInstallations', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login ou chame com Master Key.'
    );
  }

  const query = new Parse.Query(Parse.Installation);
  query.equalTo('deviceType', 'android');
  query.exists('deviceToken');
  query.limit(1000);
  const rows = await query.find({ useMasterKey: true });
  const toSave = [];
  for (const row of rows) {
    let dirty = false;
    if (row.get('pushType') !== 'gcm') {
      row.set('pushType', 'gcm');
      dirty = true;
    }
    if (!row.get('GCMSenderId')) {
      row.set('GCMSenderId', FCM_SENDER_ID);
      dirty = true;
    }
    if (!row.get('appIdentifier')) {
      row.set('appIdentifier', PUSH_APP_IDENTIFIER);
      dirty = true;
    }
    const linkedUser = row.get('user');
    if (linkedUser && linkedUser.id && row.get('userId') !== linkedUser.id) {
      row.set('userId', linkedUser.id);
      dirty = true;
    }
    if (dirty) toSave.push(row);
  }
  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }
  return { ok: true, scanned: rows.length, updated: toSave.length };
});

Parse.Cloud.define('syncUserAvatarForDisplay', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const avatarUrl = String(request.params.avatarUrl || '').trim();
  if (!avatarUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'avatarUrl obrigatorio.');
  }

  const toSave = [];

  const registrationQuery = new Parse.Query('EventRegistration');
  registrationQuery.equalTo('user', user);
  registrationQuery.limit(1000);
  const registrations = await registrationQuery.find({ useMasterKey: true });
  for (const registration of registrations) {
    if (registration.get('avatarUrl') !== avatarUrl) {
      registration.set('avatarUrl', avatarUrl);
      toSave.push(registration);
    }
  }

  const athleteProfile = await new Parse.Query('AthleteProfile')
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (athleteProfile && athleteProfile.get('userAvatarUrl') !== avatarUrl) {
    athleteProfile.set('userAvatarUrl', avatarUrl);
    toSave.push(athleteProfile);
  }

  const roleProfiles = await new Parse.Query('RoleProfile')
    .equalTo('user', user)
    .limit(50)
    .find({ useMasterKey: true });
  for (const profile of roleProfiles) {
    if (profile.get('userAvatarUrl') !== avatarUrl) {
      profile.set('userAvatarUrl', avatarUrl);
      toSave.push(profile);
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  return { ok: true, updated: toSave.length };
});

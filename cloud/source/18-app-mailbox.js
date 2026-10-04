/**
 * Caixa de mensagens do app (classe AppMessage).
 *
 * Registro permanente do que o usuario recebeu (Entrada) e enviou (Saida).
 * As pendencias com botao continuam vindo das classes de origem (RefereeInvitation,
 * MatchChallenge, TeamMatchJoinRequest...) — aqui fica o historico que nao desaparece
 * quando o assunto e resolvido.
 *
 * Escrita somente pela nuvem: use createAppMessage / createAppMessages ao lado do push.
 */

const APP_MESSAGE_CLASS = 'AppMessage';
const APP_MESSAGE_LIST_DEFAULT_LIMIT = 50;
const APP_MESSAGE_LIST_MAX_LIMIT = 100;
const APP_MESSAGE_MARK_ALL_BATCH = 200;
const APP_MESSAGE_FANOUT_MAX = 300;
const APP_MESSAGE_TITLE_MAX = 140;
const APP_MESSAGE_BODY_MAX = 1000;
const APP_MESSAGE_SEARCH_MAX = 600;
const APP_MESSAGE_SYSTEM_NAME = 'Controle de Bola';

function normalizeAppMailboxText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAppMailboxRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appMailboxUserApelido(user) {
  if (!user || !user.get) return '';
  return String(user.get('apelido') || '').trim();
}

function appMailboxUserFullName(user) {
  if (!user || !user.get) return '';
  return String(user.get('name') || '').trim();
}

function appMailboxUserDisplayName(user) {
  const apelido = appMailboxUserApelido(user);
  if (apelido) return apelido;
  const name = appMailboxUserFullName(user);
  if (name) return name;
  if (!user || !user.get) return '';
  try {
    return String(user.getUsername() || '').trim();
  } catch {
    return '';
  }
}

function appMailboxUserAvatarUrl(user) {
  if (!user || !user.get) return '';
  if (typeof resolveUserAvatarUrl === 'function') return resolveUserAvatarUrl(user);
  return String(user.get('avatarUrl') || '').trim();
}

/** Nome + avatar dos dois lados, em lote, para o searchText. Nunca lanca. */
async function loadAppMailboxUserCards(userIds) {
  const cards = new Map();
  const ids = [
    ...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
  ];
  if (!ids.length) return cards;

  try {
    for (let i = 0; i < ids.length; i += 100) {
      const rows = await new Parse.Query(Parse.User)
        .containedIn('objectId', ids.slice(i, i + 100))
        .select(['apelido', 'name', 'username', 'avatarUrl', 'avatar'])
        .limit(100)
        .find({ useMasterKey: true });
      for (const row of rows) {
        cards.set(row.id, {
          name: appMailboxUserDisplayName(row),
          apelido: appMailboxUserApelido(row),
          fullName: appMailboxUserFullName(row),
          avatarUrl: appMailboxUserAvatarUrl(row),
        });
      }
    }
  } catch (error) {
    console.error('loadAppMailboxUserCards failed', error);
  }

  return cards;
}

function buildAppMessageSearchText(parts) {
  const merged = (parts || [])
    .map((part) => normalizeAppMailboxText(part))
    .filter(Boolean)
    .join(' ');
  return merged.slice(0, APP_MESSAGE_SEARCH_MAX);
}

async function saveAppMessageRow(payload, cards) {
  const recipientId = String((payload && payload.recipientId) || '').trim();
  if (!recipientId) return null;

  const senderId = String((payload && payload.senderId) || '').trim();
  // Nao faz sentido guardar mensagem do usuario para ele mesmo.
  if (senderId && senderId === recipientId) return null;

  const title = String((payload && payload.title) || '')
    .trim()
    .slice(0, APP_MESSAGE_TITLE_MAX);
  const body = String((payload && payload.body) || '')
    .trim()
    .slice(0, APP_MESSAGE_BODY_MAX);
  if (!title && !body) return null;

  const recipientCard = cards ? cards.get(recipientId) : null;
  const senderCard = senderId && cards ? cards.get(senderId) : null;

  const row = new Parse.Object(APP_MESSAGE_CLASS);
  row.set('recipient', Parse.User.createWithoutData(recipientId));
  if (senderId) row.set('sender', Parse.User.createWithoutData(senderId));
  row.set('kind', String((payload && payload.kind) || 'app_message').trim().slice(0, 60));
  row.set('title', title);
  row.set('body', body);
  row.set('sentAt', new Date());
  row.set('relatedClass', String((payload && payload.relatedClass) || '').trim().slice(0, 60));
  row.set('relatedId', String((payload && payload.relatedId) || '').trim().slice(0, 60));
  row.set('actionRoute', String((payload && payload.actionRoute) || '').trim().slice(0, 200));
  row.set(
    'searchText',
    buildAppMessageSearchText([
      title,
      body,
      recipientCard ? recipientCard.apelido : '',
      recipientCard ? recipientCard.fullName : '',
      recipientCard ? recipientCard.name : '',
      senderCard ? senderCard.apelido : '',
      senderCard ? senderCard.fullName : '',
      senderCard ? senderCard.name : '',
      senderId ? '' : APP_MESSAGE_SYSTEM_NAME,
    ])
  );

  // Leitura so para os dois lados; escrita somente via Cloud (Master Key).
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(false);
  acl.setPublicWriteAccess(false);
  acl.setReadAccess(recipientId, true);
  if (senderId) acl.setReadAccess(senderId, true);
  row.setACL(acl);

  await row.save(null, { useMasterKey: true });
  return row;
}

/**
 * Grava uma mensagem na caixa do destinatario.
 * Nunca lanca: a notificacao nao pode derrubar o fluxo que a chamou.
 */
async function createAppMessage(payload) {
  try {
    const recipientId = String((payload && payload.recipientId) || '').trim();
    if (!recipientId) return null;
    const senderId = String((payload && payload.senderId) || '').trim();
    if (senderId && senderId === recipientId) return null;

    const cards = await loadAppMailboxUserCards([recipientId, senderId]);
    return await saveAppMessageRow(payload, cards);
  } catch (error) {
    console.error('createAppMessage failed', error);
    return null;
  }
}

/** Mesma mensagem para varios destinatarios (nomes resolvidos em um lote). */
async function createAppMessages(recipientIds, payload) {
  try {
    const senderId = String((payload && payload.senderId) || '').trim();
    const ids = [
      ...new Set((recipientIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
    ]
      .filter((id) => id !== senderId)
      .slice(0, APP_MESSAGE_FANOUT_MAX);
    if (!ids.length) return 0;

    const cards = await loadAppMailboxUserCards([...ids, senderId]);
    let created = 0;
    for (const recipientId of ids) {
      try {
        const row = await saveAppMessageRow({ ...payload, recipientId }, cards);
        if (row) created += 1;
      } catch (error) {
        console.error('createAppMessages row failed', error);
      }
    }
    return created;
  } catch (error) {
    console.error('createAppMessages failed', error);
    return 0;
  }
}

function mapAppMessageRow(row, box) {
  const sender = row.get('sender');
  const recipient = row.get('recipient');
  const counterpart = box === 'out' ? recipient : sender;
  const counterpartApelido = appMailboxUserApelido(counterpart);
  const counterpartFullName = appMailboxUserFullName(counterpart);
  const counterpartName = appMailboxUserDisplayName(counterpart);
  const sentAt = row.get('sentAt') || row.createdAt;
  const readAt = row.get('readAt');

  return {
    objectId: row.id,
    box,
    kind: row.get('kind') || '',
    title: row.get('title') || '',
    body: row.get('body') || '',
    sentAt: sentAt instanceof Date ? sentAt.toISOString() : null,
    readAt: readAt instanceof Date ? readAt.toISOString() : null,
    unread: !readAt,
    relatedClass: row.get('relatedClass') || '',
    relatedId: row.get('relatedId') || '',
    actionRoute: row.get('actionRoute') || '',
    counterpartUserId: counterpart && counterpart.id ? counterpart.id : '',
    counterpartApelido,
    counterpartFullName,
    counterpartName:
      counterpartName || (box === 'out' ? 'Destinatario' : APP_MESSAGE_SYSTEM_NAME),
    counterpartAvatarUrl: appMailboxUserAvatarUrl(counterpart),
  };
}

/** A classe so passa a existir na 1a mensagem (ou no configure). Antes disso, caixa vazia. */
function isMissingAppMessageClassError(error) {
  const code = error && error.code;
  const message = String((error && error.message) || '');
  return code === Parse.Error.INVALID_CLASS_NAME || /class .*(does ?n'?o?t exist)/i.test(message);
}

function assertAppMailboxUser(request) {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login para ver suas mensagens.');
  }
  return user;
}

Parse.Cloud.define('listAppMessages', async (request) => {
  const user = assertAppMailboxUser(request);

  const box = request.params.box === 'out' ? 'out' : 'in';
  const search = String(request.params.search || '').trim();

  const rawLimit = Number(request.params.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.trunc(rawLimit), APP_MESSAGE_LIST_MAX_LIMIT)
      : APP_MESSAGE_LIST_DEFAULT_LIMIT;

  const rawSkip = Number(request.params.skip);
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.trunc(rawSkip) : 0;

  const query = new Parse.Query(APP_MESSAGE_CLASS);
  if (box === 'out') {
    query.equalTo('sender', user);
  } else {
    query.equalTo('recipient', user);
  }

  const term = normalizeAppMailboxText(search);
  if (term) {
    query.matches('searchText', escapeAppMailboxRegExp(term), 'i');
  }

  query.include(box === 'out' ? 'recipient' : 'sender');
  query.descending('sentAt');
  query.skip(skip);
  query.limit(limit);

  let rows = [];
  try {
    rows = await query.find({ useMasterKey: true });
  } catch (error) {
    if (!isMissingAppMessageClassError(error)) throw error;
    return [];
  }
  return rows.map((row) => mapAppMessageRow(row, box));
});

Parse.Cloud.define('markAppMessageRead', async (request) => {
  const user = assertAppMailboxUser(request);
  const messageId = String(request.params.messageId || '').trim();
  if (!messageId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a mensagem.');
  }

  const row = await new Parse.Query(APP_MESSAGE_CLASS).get(messageId, { useMasterKey: true });
  const recipient = row.get('recipient');
  if (!recipient || recipient.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o destinatario pode marcar esta mensagem como lida.'
    );
  }

  let readAt = row.get('readAt');
  if (!(readAt instanceof Date)) {
    readAt = new Date();
    row.set('readAt', readAt);
    await row.save(null, { useMasterKey: true });
  }

  return { ok: true, messageId, readAt: readAt.toISOString() };
});

Parse.Cloud.define('markAllAppMessagesRead', async (request) => {
  const user = assertAppMailboxUser(request);

  let rows = [];
  try {
    rows = await new Parse.Query(APP_MESSAGE_CLASS)
      .equalTo('recipient', user)
      .doesNotExist('readAt')
      .limit(APP_MESSAGE_MARK_ALL_BATCH)
      .find({ useMasterKey: true });
  } catch (error) {
    if (!isMissingAppMessageClassError(error)) throw error;
    return { ok: true, updated: 0, hasMore: false };
  }

  if (!rows.length) {
    return { ok: true, updated: 0, hasMore: false };
  }

  const readAt = new Date();
  for (const row of rows) {
    row.set('readAt', readAt);
  }
  await Parse.Object.saveAll(rows, { useMasterKey: true });

  return {
    ok: true,
    updated: rows.length,
    hasMore: rows.length === APP_MESSAGE_MARK_ALL_BATCH,
  };
});

Parse.Cloud.define('countUnreadAppMessages', async (request) => {
  const user = assertAppMailboxUser(request);

  try {
    const count = await new Parse.Query(APP_MESSAGE_CLASS)
      .equalTo('recipient', user)
      .doesNotExist('readAt')
      .count({ useMasterKey: true });
    return { count };
  } catch (error) {
    if (!isMissingAppMessageClassError(error)) throw error;
    return { count: 0 };
  }
});

Parse.Cloud.define('configureAppMailboxClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const denied = {};
  const clp = {
    find: authRead,
    get: authRead,
    count: authRead,
    create: denied,
    update: denied,
    delete: denied,
    addField: denied,
    protectedFields: {},
  };

  // 1a execucao cria a classe com os campos; nas seguintes apenas o CLP e reaplicado.
  let created = false;
  try {
    const schema = new Parse.Schema(APP_MESSAGE_CLASS);
    schema.addPointer('recipient', '_User');
    schema.addPointer('sender', '_User');
    schema.addString('kind');
    schema.addString('title');
    schema.addString('body');
    schema.addDate('sentAt');
    schema.addDate('readAt');
    schema.addString('relatedClass');
    schema.addString('relatedId');
    schema.addString('actionRoute');
    schema.addString('searchText');
    schema.setCLP(clp);
    await schema.save();
    created = true;
  } catch {
    const schema = new Parse.Schema(APP_MESSAGE_CLASS);
    schema.setCLP(clp);
    await schema.update();
  }

  return {
    ok: true,
    className: APP_MESSAGE_CLASS,
    created,
    updated: !created,
    message: 'CLP atualizado para AppMessage (leitura autenticada, escrita so via Cloud).',
  };
});

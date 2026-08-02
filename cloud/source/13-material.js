/** Controle de material da pelada / ropeiro (kitman) e sessao por evento */

const MATERIAL_INVENTORY_CLASS = 'MaterialInventoryItem';
const EVENT_MATERIAL_SESSION_CLASS = 'EventMaterialSession';

const MATERIAL_ITEM_TYPES = [
  'shirt',
  'bib',
  'shorts',
  'socks',
  'shin_guards',
  'gloves',
  'captain_armband',
  'ball',
  'goal_net',
  'water_bottle',
  'water_gallon',
  'goal_post',
];

const MATERIAL_ITEM_LABELS = {
  shirt: 'Camisas',
  bib: 'Coletes',
  shorts: 'Calcoes',
  socks: 'Pares de Meioes',
  shin_guards: 'Pares de Caneleiras',
  gloves: 'Pares de Luvas',
  captain_armband: 'Faixa de capitao',
  ball: 'Bolas',
  goal_net: 'Pares Redes de Barras',
  water_bottle: "Garrafas d'agua",
  water_gallon: "Garrafoes d'agua",
  goal_post: 'Pares de Barras',
};

function materialLineLabel(itemType, color) {
  const base = MATERIAL_ITEM_LABELS[itemType] || itemType;
  const normalized = String(color || '').trim();
  return normalized ? `${base} (${normalized})` : base;
}

function normalizeColor(color) {
  return String(color || '').trim();
}

function mapInventoryItem(obj) {
  const quantity = Math.max(0, Number(obj.get('quantity') || 0));
  const damagedQuantity = Math.max(0, Number(obj.get('damagedQuantity') || 0));
  const pelada = obj.get('pelada');
  const user = obj.get('user');
  return {
    objectId: obj.id,
    ownerType: obj.get('ownerType') || 'pelada',
    peladaId: pelada && pelada.id ? pelada.id : undefined,
    userId: user && user.id ? user.id : undefined,
    itemType: obj.get('itemType') || 'ball',
    color: normalizeColor(obj.get('color')),
    quantity,
    damagedQuantity,
    // Avaria e qualificativa: o item continua utilizavel no evento.
    availableQuantity: quantity,
  };
}

function normalizeLines(rawLines) {
  if (!Array.isArray(rawLines)) return [];
  return rawLines.map((line) => {
    const quantityBlindCounted =
      line.quantityBlindCounted == null
        ? null
        : Math.max(0, Number(line.quantityBlindCounted || 0));
    let quantityDamagedCounted =
      line.quantityDamagedCounted == null
        ? null
        : Math.max(0, Number(line.quantityDamagedCounted || 0));
    if (
      quantityBlindCounted != null &&
      quantityDamagedCounted != null &&
      quantityDamagedCounted > quantityBlindCounted
    ) {
      quantityDamagedCounted = quantityBlindCounted;
    }
    return {
      inventoryItemId: line.inventoryItemId ? String(line.inventoryItemId) : undefined,
      itemType: String(line.itemType || 'ball'),
      color: normalizeColor(line.color),
      quantityLoaded: Math.max(0, Number(line.quantityLoaded || 0)),
      quantitySent: Math.max(0, Number(line.quantitySent || 0)),
      quantityReturned: Math.max(0, Number(line.quantityReturned || 0)),
      quantityBlindCounted,
      quantityDamagedCounted,
    };
  });
}

async function applyInventoryDamagesFromConference(lines) {
  for (const line of lines) {
    const damaged = Math.max(0, Number(line.quantityDamagedCounted || 0));
    if (!line.inventoryItemId || damaged <= 0) continue;
    try {
      const item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(line.inventoryItemId, {
        useMasterKey: true,
      });
      const quantity = Math.max(0, Number(item.get('quantity') || 0));
      const current = Math.max(0, Number(item.get('damagedQuantity') || 0));
      item.set('damagedQuantity', Math.min(quantity, current + damaged));
      await item.save(null, { useMasterKey: true });
    } catch {
      // Continua demais itens
    }
  }
}

function computeDivergences(lines, mode) {
  const rows = [];
  for (const line of lines) {
    if (line.quantityBlindCounted == null) continue;
    const expected =
      mode === 'return'
        ? line.quantitySent
        : line.quantitySent || line.quantityLoaded;
    const counted = Number(line.quantityBlindCounted) || 0;
    const delta = counted - expected;
    if (delta === 0) continue;
    rows.push({
      itemType: line.itemType,
      color: line.color,
      label: materialLineLabel(line.itemType, line.color),
      expected,
      counted,
      delta,
    });
  }
  return rows;
}

async function getCounterpartyName(userId) {
  if (!userId) return undefined;
  try {
    const user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
    return (
      user.get('apelido') ||
      user.get('name') ||
      user.getUsername() ||
      'Ropeiro'
    );
  } catch {
    return 'Ropeiro';
  }
}

/** Resolve o unico ropeiro do evento (inscricao ou convite aceito). */
async function resolveEventKitmanCounterparty(event) {
  const kitmanReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'kitman')
    .include('user')
    .ascending('createdAt')
    .first({ useMasterKey: true });
  const kitmanUser = kitmanReg && kitmanReg.get('user');
  if (kitmanUser && kitmanUser.id) {
    return {
      userId: kitmanUser.id,
      displayName:
        kitmanReg.get('userDisplayName') ||
        kitmanReg.get('apelido') ||
        (await getCounterpartyName(kitmanUser.id)),
    };
  }

  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('role', 'kitman')
    .containedIn('status', ['accepted', 'presence_confirmed', 'payment_released', 'completed'])
    .include('invitedUser')
    .ascending('createdAt')
    .first({ useMasterKey: true });
  const invited = invitation && invitation.get('invitedUser');
  if (invited && invited.id) {
    return {
      userId: invited.id,
      displayName: await getCounterpartyName(invited.id),
    };
  }
  return null;
}

async function ensurePeladaSessionKitmanCounterparty(session, event) {
  if ((session.get('materialSource') || 'none') !== 'pelada') {
    return session;
  }
  if (session.get('counterpartyUserId')) {
    return session;
  }
  const kitman = await resolveEventKitmanCounterparty(event);
  if (!kitman) {
    return session;
  }
  session.set('counterpartyUserId', kitman.userId);
  session.set('counterpartyName', kitman.displayName);
  await session.save(null, { useMasterKey: true });
  return session;
}

function mapSession(obj) {
  const materialSource = obj.get('materialSource') || 'none';
  const lines = normalizeLines(obj.get('lines'));
  const mode = materialSource === 'pelada' ? 'return' : 'receive';
  const stored = obj.get('divergences');
  const divergences = Array.isArray(stored) ? stored : computeDivergences(lines, mode);
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : '',
    materialSource,
    counterpartyUserId: obj.get('counterpartyUserId') || undefined,
    counterpartyName: obj.get('counterpartyName') || undefined,
    status: obj.get('status') || 'idle',
    lines,
    divergences,
    lossesApplied: !!obj.get('lossesApplied'),
    updatedAt: obj.get('updatedAt') ? obj.get('updatedAt').toISOString() : undefined,
  };
}

async function assertEventMaterialActor(eventId, user) {
  const event = await new Parse.Query('Event')
    .include('pelada')
    .include('admin')
    .get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  const isAdmin = !!(admin && admin.id === user.id);

  const kitmanRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'kitman')
    .first({ useMasterKey: true });

  let isContractedKitman = false;
  if (kitmanRegistration) {
    isContractedKitman = true;
  } else {
    const invitation = await new Parse.Query('RefereeInvitation')
      .equalTo('event', event)
      .equalTo('invitedUser', user)
      .equalTo('role', 'kitman')
      .containedIn('status', ['accepted', 'presence_confirmed', 'payment_released', 'completed'])
      .first({ useMasterKey: true });
    isContractedKitman = !!invitation;
  }

  if (!isAdmin && !isContractedKitman) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador ou o ropeiro do evento podem gerenciar material.'
    );
  }

  return { event, isAdmin, isContractedKitman };
}

async function getOrCreateSession(event) {
  let session = await new Parse.Query(EVENT_MATERIAL_SESSION_CLASS)
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (session) return session;

  session = new Parse.Object(EVENT_MATERIAL_SESSION_CLASS);
  session.set('event', event);
  session.set('materialSource', 'none');
  session.set('status', 'idle');
  session.set('lines', []);
  session.set('divergences', []);
  session.set('lossesApplied', false);
  await session.save(null, { useMasterKey: true });
  return session;
}

async function assertInventoryOwnerAccess(ownerType, peladaId, user) {
  if (ownerType === 'kitman') {
    return { ownerType: 'kitman', user };
  }
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  const pelada = await assertPeladaAdminUser(peladaId, user);
  return { ownerType: 'pelada', pelada, user };
}

Parse.Cloud.define('listMaterialInventory', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const ownerType = String(request.params.ownerType || '').trim();
  if (ownerType !== 'pelada' && ownerType !== 'kitman') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'ownerType invalido.');
  }

  const query = new Parse.Query(MATERIAL_INVENTORY_CLASS);
  query.equalTo('ownerType', ownerType);
  if (ownerType === 'pelada') {
    const peladaId = String(request.params.peladaId || '').trim();
    if (!peladaId) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
    }
    const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
    const admin = pelada.get('admin');
    if (!admin || admin.id !== user.id) {
      // Socios ativos tambem podem visualizar (somente leitura); mutacoes sao admin-only.
      const membership = await new Parse.Query('PeladaMembership')
        .equalTo('pelada', pelada)
        .equalTo('user', user)
        .equalTo('status', 'active')
        .first({ useMasterKey: true });
      if (!membership) {
        throw new Parse.Error(
          Parse.Error.OPERATION_FORBIDDEN,
          'Sem permissao para ver o material desta pelada.'
        );
      }
    }
    query.equalTo('pelada', pelada);
  } else {
    query.equalTo('user', user);
  }

  query.ascending('itemType');
  query.addAscending('color');
  query.limit(500);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapInventoryItem);
});

Parse.Cloud.define('upsertMaterialInventoryItem', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const ownerType = String(request.params.ownerType || '').trim();
  const itemType = String(request.params.itemType || '').trim();
  const color = normalizeColor(request.params.color);
  const quantity = Math.max(0, Number(request.params.quantity || 0));
  const damagedQuantity = Math.max(0, Number(request.params.damagedQuantity || 0));
  const objectId = String(request.params.objectId || '').trim();

  if (ownerType !== 'pelada' && ownerType !== 'kitman') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'ownerType invalido.');
  }
  if (!MATERIAL_ITEM_TYPES.includes(itemType)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Tipo de material invalido.');
  }
  if (damagedQuantity > quantity) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Quantidade avariada nao pode ser maior que a quantidade total.'
    );
  }

  const access = await assertInventoryOwnerAccess(
    ownerType,
    String(request.params.peladaId || '').trim(),
    user
  );

  let item;
  if (objectId) {
    item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(objectId, {
      useMasterKey: true,
    });
    if (ownerType === 'pelada') {
      const pelada = item.get('pelada');
      if (!pelada || pelada.id !== access.pelada.id) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Item nao encontrado.');
      }
    } else {
      const owner = item.get('user');
      if (!owner || owner.id !== user.id) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Item nao encontrado.');
      }
    }
  } else {
    item = new Parse.Object(MATERIAL_INVENTORY_CLASS);
    item.set('ownerType', ownerType);
    if (ownerType === 'pelada') {
      item.set('pelada', access.pelada);
      item.unset('user');
    } else {
      item.set('user', user);
      item.unset('pelada');
    }
  }

  item.set('itemType', itemType);
  item.set('color', color);
  item.set('quantity', quantity);
  item.set('damagedQuantity', damagedQuantity);
  await item.save(null, { useMasterKey: true });
  return mapInventoryItem(item);
});

Parse.Cloud.define('deleteMaterialInventoryItem', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const objectId = String(request.params.objectId || '').trim();
  if (!objectId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'objectId obrigatorio.');
  }

  const item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(objectId, {
    useMasterKey: true,
  });
  const ownerType = item.get('ownerType');
  if (ownerType === 'kitman') {
    const owner = item.get('user');
    if (!owner || owner.id !== user.id) {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem permissao.');
    }
  } else {
    const pelada = item.get('pelada');
    if (!pelada || !pelada.id) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Item invalido.');
    }
    await assertPeladaAdminUser(pelada.id, user);
  }

  await item.destroy({ useMasterKey: true });
  return { ok: true };
});

Parse.Cloud.define('getEventMaterialSession', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  await assertEventMaterialActor(eventId, user);
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  let session = await getOrCreateSession(event);
  session = await ensurePeladaSessionKitmanCounterparty(session, event);
  return mapSession(session);
});

Parse.Cloud.define('setEventMaterialSource', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const materialSource = String(request.params.materialSource || '').trim();
  const counterpartyUserId = String(request.params.counterpartyUserId || '').trim();

  if (!['pelada', 'kitman', 'none'].includes(materialSource)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Origem de material invalida.');
  }

  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );

  const session = await getOrCreateSession(event);
  const currentSource = session.get('materialSource') || 'none';

  // Admin define origem; se ja for material da pelada, ropeiro nao pode trocar.
  if (!isAdmin && isContractedKitman) {
    if (materialSource === 'pelada') {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'Apenas o administrador define uso do material da pelada.'
      );
    }
    if (currentSource === 'pelada') {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'O administrador ja definiu uso do material da pelada neste evento.'
      );
    }
  }

  session.set('materialSource', materialSource);
  session.set('lines', []);
  session.set('divergences', []);
  session.set('lossesApplied', false);
  session.set('status', 'idle');

  if (materialSource === 'none') {
    session.unset('counterpartyUserId');
    session.unset('counterpartyName');
  } else if (counterpartyUserId) {
    session.set('counterpartyUserId', counterpartyUserId);
    session.set('counterpartyName', await getCounterpartyName(counterpartyUserId));
  } else if (materialSource === 'kitman' && isContractedKitman) {
    session.set('counterpartyUserId', user.id);
    session.set('counterpartyName', await getCounterpartyName(user.id));
  } else if (materialSource === 'pelada' && isAdmin) {
    const kitman = await resolveEventKitmanCounterparty(event);
    if (kitman) {
      session.set('counterpartyUserId', kitman.userId);
      session.set('counterpartyName', kitman.displayName);
    } else {
      session.unset('counterpartyUserId');
      session.unset('counterpartyName');
    }
  }

  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('loadEventMaterial', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const mode = String(request.params.mode || 'all').trim();
  const partialLines = Array.isArray(request.params.lines) ? request.params.lines : [];

  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );
  const session = await getOrCreateSession(event);
  const materialSource = session.get('materialSource') || 'none';
  if (materialSource === 'none') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Defina a origem do material antes de carregar.'
    );
  }
  if (materialSource === 'pelada' && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador carrega o material da pelada.'
    );
  }
  if (materialSource === 'kitman' && !isContractedKitman && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o ropeiro carrega o proprio material.'
    );
  }

  const inventoryQuery = new Parse.Query(MATERIAL_INVENTORY_CLASS);
  if (materialSource === 'pelada') {
    const pelada = event.get('pelada');
    if (!pelada || !pelada.id) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Evento sem pelada.');
    }
    inventoryQuery.equalTo('ownerType', 'pelada');
    inventoryQuery.equalTo('pelada', Parse.Object.extend('Pelada').createWithoutData(pelada.id));
  } else {
    const kitmanUserId = session.get('counterpartyUserId') || (isContractedKitman ? user.id : '');
    if (!kitmanUserId) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Ropeiro nao identificado. Contrate um ropeiro ou informe a contraparte.'
      );
    }
    inventoryQuery.equalTo('ownerType', 'kitman');
    inventoryQuery.equalTo('user', Parse.User.createWithoutData(kitmanUserId));
  }

  inventoryQuery.limit(500);
  const inventory = await inventoryQuery.find({ useMasterKey: true });
  const byId = new Map(inventory.map((row) => [row.id, row]));

  let lines = [];
  if (mode === 'all') {
    lines = inventory
      .map((row) => {
        const mapped = mapInventoryItem(row);
        if (mapped.availableQuantity <= 0) return null;
        return {
          inventoryItemId: mapped.objectId,
          itemType: mapped.itemType,
          color: mapped.color,
          quantityLoaded: mapped.availableQuantity,
          quantitySent: 0,
          quantityReturned: 0,
          quantityBlindCounted: null,
          quantityDamagedCounted: null,
        };
      })
      .filter(Boolean);
  } else {
    for (const entry of partialLines) {
      const inventoryItemId = String(entry.inventoryItemId || '').trim();
      const quantity = Math.max(0, Number(entry.quantity || 0));
      if (!inventoryItemId || quantity <= 0) continue;
      const row = byId.get(inventoryItemId);
      if (!row) continue;
      const mapped = mapInventoryItem(row);
      lines.push({
        inventoryItemId: mapped.objectId,
        itemType: mapped.itemType,
        color: mapped.color,
        quantityLoaded: Math.min(quantity, mapped.availableQuantity),
        quantitySent: 0,
        quantityReturned: 0,
        quantityBlindCounted: null,
        quantityDamagedCounted: null,
      });
    }
  }

  if (!lines.length) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Nenhum item disponivel para carregar.'
    );
  }

  session.set('lines', lines);
  session.set('divergences', []);
  session.set('lossesApplied', false);
  session.set('status', 'loaded');
  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('sendEventMaterial', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );
  const session = await getOrCreateSession(event);
  const materialSource = session.get('materialSource') || 'none';
  const lines = normalizeLines(session.get('lines'));
  if (!lines.length) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Carregue o material antes de enviar.');
  }

  if (materialSource === 'pelada' && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador envia o material da pelada.'
    );
  }
  if (materialSource === 'kitman' && !isContractedKitman && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o ropeiro envia o proprio material.'
    );
  }

  if (materialSource === 'pelada') {
    await ensurePeladaSessionKitmanCounterparty(session, event);
    if (!session.get('counterpartyUserId')) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Contrate um ropeiro no evento antes de enviar o material.'
      );
    }
  }

  const sent = lines.map((line) => ({
    ...line,
    quantitySent: line.quantityLoaded,
    quantityReturned: 0,
    quantityBlindCounted: null,
    quantityDamagedCounted: null,
  }));
  session.set('lines', sent);
  session.set('divergences', []);
  session.set('status', 'sent');
  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('submitEventMaterialBlindCount', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const counts = Array.isArray(request.params.counts) ? request.params.counts : [];
  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );
  const session = await getOrCreateSession(event);
  const materialSource = session.get('materialSource') || 'none';
  const lines = normalizeLines(session.get('lines'));
  if (!lines.length || session.get('status') === 'idle') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao ha material enviado para conferir.');
  }

  // Contagem cega:
  // - material da pelada: ropeiro confere o que recebeu do admin
  // - material do ropeiro: admin confere o que recebeu do ropeiro
  if (materialSource === 'pelada' && !isContractedKitman && !isAdmin) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem permissao para conferir.');
  }
  if (materialSource === 'kitman' && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador faz a contagem cega do material do ropeiro.'
    );
  }

  const countMap = new Map();
  const damagedMap = new Map();
  for (const row of counts) {
    const key = `${String(row.itemType || '')}::${normalizeColor(row.color).toLowerCase()}`;
    countMap.set(key, Math.max(0, Number(row.quantity || 0)));
    if (row.damagedQuantity != null) {
      damagedMap.set(key, Math.max(0, Number(row.damagedQuantity || 0)));
    }
  }

  const updated = lines.map((line) => {
    const key = `${line.itemType}::${normalizeColor(line.color).toLowerCase()}`;
    const counted = countMap.has(key) ? countMap.get(key) : line.quantityBlindCounted;
    let damagedCounted = damagedMap.has(key)
      ? damagedMap.get(key)
      : line.quantityDamagedCounted;
    if (counted != null && damagedCounted != null && damagedCounted > counted) {
      damagedCounted = counted;
    }
    return {
      ...line,
      quantityBlindCounted: counted == null ? null : counted,
      quantityDamagedCounted: damagedCounted == null ? null : damagedCounted,
    };
  });

  const divergences = computeDivergences(updated, 'receive');
  session.set('lines', updated);
  session.set('divergences', divergences);
  session.set('status', 'received');
  await session.save(null, { useMasterKey: true });
  await applyInventoryDamagesFromConference(updated);
  return mapSession(session);
});

Parse.Cloud.define('receiveEventMaterialReturn', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const counts = Array.isArray(request.params.counts) ? request.params.counts : [];
  const { event, isAdmin } = await assertEventMaterialActor(eventId, user);
  if (!isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador recebe a devolucao do material.'
    );
  }

  const session = await getOrCreateSession(event);
  if ((session.get('materialSource') || 'none') !== 'pelada') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Devolucao aplica-se quando o material usado e o da pelada.'
    );
  }
  const lines = normalizeLines(session.get('lines'));
  if (!lines.length || session.get('status') === 'idle' || session.get('status') === 'loaded') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Envie o material antes de receber a devolucao.');
  }

  const countMap = new Map();
  const damagedMap = new Map();
  for (const row of counts) {
    const key = `${String(row.itemType || '')}::${normalizeColor(row.color).toLowerCase()}`;
    countMap.set(key, Math.max(0, Number(row.quantity || 0)));
    if (row.damagedQuantity != null) {
      damagedMap.set(key, Math.max(0, Number(row.damagedQuantity || 0)));
    }
  }

  const updated = lines.map((line) => {
    const key = `${line.itemType}::${normalizeColor(line.color).toLowerCase()}`;
    const counted = countMap.has(key)
      ? countMap.get(key)
      : line.quantityBlindCounted != null
        ? line.quantityBlindCounted
        : line.quantitySent;
    let damagedCounted = damagedMap.has(key)
      ? damagedMap.get(key)
      : line.quantityDamagedCounted != null
        ? line.quantityDamagedCounted
        : 0;
    if (damagedCounted > counted) {
      damagedCounted = counted;
    }
    return {
      ...line,
      quantityReturned: counted,
      quantityBlindCounted: counted,
      quantityDamagedCounted: damagedCounted,
    };
  });
  const divergences = computeDivergences(updated, 'return');
  session.set('lines', updated);
  session.set('divergences', divergences);
  session.set('status', 'reconciled');
  await session.save(null, { useMasterKey: true });
  // Soma apenas avarias novas informadas nesta conferência de devolucao.
  await applyInventoryDamagesFromConference(
    updated.map((line) => {
      const prior = lines.find(
        (row) =>
          row.itemType === line.itemType &&
          normalizeColor(row.color).toLowerCase() ===
            normalizeColor(line.color).toLowerCase()
      );
      const priorDamaged = Math.max(0, Number(prior?.quantityDamagedCounted || 0));
      const currentDamaged = Math.max(0, Number(line.quantityDamagedCounted || 0));
      return {
        ...line,
        quantityDamagedCounted: Math.max(0, currentDamaged - priorDamaged),
      };
    })
  );
  return mapSession(session);
});

Parse.Cloud.define('applyEventMaterialLosses', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventMaterialActor(eventId, user);
  if (!isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador aplica baixas no inventario da pelada.'
    );
  }

  const session = await getOrCreateSession(event);
  if ((session.get('materialSource') || 'none') !== 'pelada') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Baixa automatica aplica-se ao inventario da pelada.'
    );
  }
  if (session.get('lossesApplied')) {
    return mapSession(session);
  }

  const lines = normalizeLines(session.get('lines'));
  const divergences = computeDivergences(lines, 'return');
  for (const divergence of divergences) {
    if (divergence.delta >= 0) continue; // so falta/perda
    const loss = Math.abs(divergence.delta);
    const line = lines.find(
      (row) =>
        row.itemType === divergence.itemType &&
        normalizeColor(row.color).toLowerCase() ===
          normalizeColor(divergence.color).toLowerCase()
    );
    if (!line || !line.inventoryItemId) continue;
    try {
      const item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(
        line.inventoryItemId,
        { useMasterKey: true }
      );
      const quantity = Math.max(0, Number(item.get('quantity') || 0));
      const damaged = Math.max(0, Number(item.get('damagedQuantity') || 0));
      item.set('quantity', Math.max(0, quantity - loss));
      item.set('damagedQuantity', Math.min(damaged, Math.max(0, quantity - loss)));
      await item.save(null, { useMasterKey: true });
    } catch {
      // Continua demais itens
    }
  }

  session.set('lossesApplied', true);
  session.set('status', 'reconciled');
  session.set('divergences', divergences);
  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('configureMaterialClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  // Mutacoes passam por Cloud Functions (master key). Bloqueia escrita direta do cliente.
  const authRead = { requiresAuthentication: true };
  const denied = {};
  const schemaInventory = new Parse.Schema(MATERIAL_INVENTORY_CLASS);
  schemaInventory.setCLP({
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
    await schemaInventory.update();
  } catch {
    await schemaInventory.save();
  }

  const schemaSession = new Parse.Schema(EVENT_MATERIAL_SESSION_CLASS);
  schemaSession.setCLP({
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
    await schemaSession.update();
  } catch {
    await schemaSession.save();
  }

  return {
    ok: true,
    message: 'CLP atualizado para MaterialInventoryItem e EventMaterialSession.',
  };
});

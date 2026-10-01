/** Tempo no destaque do mural App (Geral / Peladas / Confrontos). */

const MURAL_TENURE_BUCKETS = new Set(['merged', 'pelada', 'team_match']);

const MURAL_SINGLE_HIGHLIGHT_KEYS = new Set([
  'craque',
  'melhor_goleiro',
  'melhor_juiz',
  'time_mais_amado',
  'promessa',
  'master',
]);

function normalizeMuralTenureHolderKey(value) {
  return String(value || '').trim();
}

function muralTenureRowIdentity(highlightKey, holderKey) {
  return `${highlightKey}::${holderKey}`;
}

Parse.Cloud.define('syncMuralHighlightTenures', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'Faca login para sincronizar destaques.');
  }

  const bucket = String(request.params.bucket || '').trim();
  if (!MURAL_TENURE_BUCKETS.has(bucket)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'bucket invalido.');
  }

  const holders = request.params.holders;
  if (!holders || typeof holders !== 'object') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'holders obrigatorio.');
  }

  const now = new Date();
  const Tenure = Parse.Object.extend('MuralHighlightTenure');

  const existingQuery = new Parse.Query(Tenure);
  existingQuery.equalTo('bucket', bucket);
  existingQuery.limit(1000);
  const existingRows = await existingQuery.find({ useMasterKey: true });

  const existingByIdentity = new Map();
  for (const row of existingRows) {
    const highlightKey = String(row.get('highlightKey') || '').trim();
    const holderKey = normalizeMuralTenureHolderKey(row.get('holderKey'));
    if (!highlightKey || !holderKey) continue;
    existingByIdentity.set(muralTenureRowIdentity(highlightKey, holderKey), row);
  }

  const holderKeysSent = Object.keys(holders);
  const desiredIdentities = new Set();
  const tenures = {};

  for (const highlightKey of holderKeysSent) {
    const hk = String(highlightKey || '').trim();
    if (!hk) continue;
    const rawHolder = holders[hk];
    const holderKey = normalizeMuralTenureHolderKey(rawHolder);

    if (!holderKey) {
      for (const row of existingRows) {
        if (String(row.get('highlightKey') || '').trim() !== hk) continue;
        await row.destroy({ useMasterKey: true });
        const rowHolder = normalizeMuralTenureHolderKey(row.get('holderKey'));
        existingByIdentity.delete(muralTenureRowIdentity(hk, rowHolder));
      }
      continue;
    }

    desiredIdentities.add(muralTenureRowIdentity(hk, holderKey));

    if (MURAL_SINGLE_HIGHLIGHT_KEYS.has(hk)) {
      for (const row of existingRows) {
        const rowHk = String(row.get('highlightKey') || '').trim();
        if (rowHk !== hk) continue;
        const rowHolder = normalizeMuralTenureHolderKey(row.get('holderKey'));
        if (rowHolder === holderKey) continue;
        await row.destroy({ useMasterKey: true });
        existingByIdentity.delete(muralTenureRowIdentity(hk, rowHolder));
      }
    }

    let row = existingByIdentity.get(muralTenureRowIdentity(hk, holderKey));
    if (!row) {
      row = new Tenure();
      row.set('bucket', bucket);
      row.set('highlightKey', hk);
      row.set('holderKey', holderKey);
      row.set('sinceAt', now);
      const acl = new Parse.ACL();
      acl.setPublicReadAccess(false);
      acl.setPublicWriteAccess(false);
      row.setACL(acl);
      await row.save(null, { useMasterKey: true });
      existingByIdentity.set(muralTenureRowIdentity(hk, holderKey), row);
    }

    const sinceAt = row.get('sinceAt');
    if (sinceAt instanceof Date) {
      tenures[hk] = { sinceAt: sinceAt.toISOString(), holderKey };
    }
  }

  for (const row of existingRows) {
    const highlightKey = String(row.get('highlightKey') || '').trim();
    const holderKey = normalizeMuralTenureHolderKey(row.get('holderKey'));
    if (!highlightKey || !holderKey) continue;
    const identity = muralTenureRowIdentity(highlightKey, holderKey);
    if (desiredIdentities.has(identity)) continue;

    if (highlightKey.startsWith('goleador:')) {
      if (!Object.prototype.hasOwnProperty.call(holders, highlightKey)) {
        await row.destroy({ useMasterKey: true });
      }
    }
  }

  return { tenures };
});

Parse.Cloud.define('configureMuralHighlightTenurePermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const className = 'MuralHighlightTenure';
  const schema = new Parse.Schema(className);
  schema.addString('bucket');
  schema.addString('highlightKey');
  schema.addString('holderKey');
  schema.addDate('sinceAt');
  schema.setCLP({
    find: authRead,
    get: authRead,
    count: authRead,
    create: {},
    update: {},
    delete: {},
    addField: {},
    protectedFields: {},
  });

  let created = false;
  try {
    await schema.update();
  } catch {
    await schema.save();
    created = true;
  }

  return { ok: true, className, created, updated: !created };
});

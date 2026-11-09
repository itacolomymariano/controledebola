/**
 * Integridade de CPF em _User — inventario e politicas de producao.
 * Nunca chame inventoryDuplicateCpfs do app cliente. Ver docs/USER-CPF-INTEGRITY.md
 */

function getCpfOpsSecret() {
  return String(process.env.PROD_PURGE_SECRET || process.env.CPF_INTEGRITY_SECRET || '').trim();
}

function assertCpfOpsAuthorized(request) {
  if (request.master) return;
  const expected = getCpfOpsSecret();
  if (!expected) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Configure PROD_PURGE_SECRET ou CPF_INTEGRITY_SECRET no Back4App.'
    );
  }
  const provided = String(request.params.secret || request.params.opsSecret || '').trim();
  if (provided !== expected) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Secret invalido para operacao de CPF.');
  }
}

function userCpfSnapshot(user) {
  const cpf = normalizeCpfDigits(user.get('cpf'));
  if (!cpf || cpf.length !== 11) return null;
  const email = user.get('email') || user.getUsername() || '';
  const phone = user.get('phone') || '';
  const lastLogin = user.get('lastLoginAt') || user.get('updatedAt') || user.get('createdAt');
  return {
    objectId: user.id,
    username: user.getUsername() || '',
    name: String(user.get('name') || ''),
    apelido: String(user.get('apelido') || ''),
    email: String(email),
    phone: String(phone),
    cpf,
    createdAt: user.get('createdAt') ? user.get('createdAt').toISOString() : null,
    lastLoginAt: lastLogin instanceof Date ? lastLogin.toISOString() : null,
  };
}

/**
 * Re-valida CPF unico antes de salvar usuario novo (mitiga condicao de corrida).
 */
async function assertCpfUniqueForNewUser(cpf, excludeUserId) {
  if (!cpf) return;
  const query = new Parse.Query(Parse.User);
  query.equalTo('cpf', cpf);
  query.limit(5);
  const existing = await query.find({ useMasterKey: true });
  const conflict = existing.find((row) => row.id !== excludeUserId);
  if (conflict) {
    throw new Parse.Error(
      Parse.Error.DUPLICATE_VALUE,
      'CPF ja cadastrado. Faca login com a conta existente. Se esqueceu a senha, use Recuperar senha na tela de login.'
    );
  }
}

Parse.Cloud.define('inventoryDuplicateCpfs', async (request) => {
  assertCpfOpsAuthorized(request);

  const batchSize = Math.min(Math.max(Number(request.params.limit) || 1000, 100), 1000);
  const maxBatches = Math.min(Math.max(Number(request.params.maxBatches) || 50, 1), 200);

  const byCpf = new Map();
  let totalScanned = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const query = new Parse.Query(Parse.User);
    query.exists('cpf');
    query.ascending('createdAt');
    query.skip(batch * batchSize);
    query.limit(batchSize);
    const rows = await query.find({ useMasterKey: true });
    if (!rows.length) break;

    for (const user of rows) {
      const snap = userCpfSnapshot(user);
      if (!snap) continue;
      totalScanned += 1;
      const list = byCpf.get(snap.cpf) || [];
      list.push(snap);
      byCpf.set(snap.cpf, list);
    }

    if (rows.length < batchSize) break;
  }

  const duplicates = [];
  for (const [cpf, users] of byCpf.entries()) {
    const distinctIds = new Set(users.map((u) => u.objectId));
    if (distinctIds.size > 1) {
      duplicates.push({ cpf, count: distinctIds.size, users });
    }
  }

  duplicates.sort((a, b) => b.count - a.count || a.cpf.localeCompare(b.cpf));

  return {
    scannedWithCpf: totalScanned,
    duplicateCpfCount: duplicates.length,
    duplicates,
    hint: 'Decida manualmente qual conta manter por CPF. Nao ha exclusao automatica nesta funcao.',
  };
});

/**
 * Limpeza controlada de dados de teste antes do go-live (Master Key + secret).
 * Nunca chame do app cliente. Ver docs/PROD-DATA-PURGE.md
 */

const PURGE_SKIP_CLASSES = new Set(['MailSettings', '_GlobalConfig']);

/** Filhos primeiro; MailSettings nunca entra aqui. */
const PURGE_CLASS_ORDER = [
  'EventMediaComment',
  'EventMediaVote',
  'EventMediaView',
  'EventMediaReaction',
  'EventMediaPublication',
  'MuralVote',
  'EventPerformance',
  'FanPrediction',
  'FanEventCheckIn',
  'CoachEventBoard',
  'MasseurTreatment',
  'PhysicalTrainerSession',
  'EventMaterialSession',
  'MaterialInventoryItem',
  'RefereeInvitation',
  'TeamMatchJoinRequest',
  'AmateurTeamJoinRequest',
  'EventRegistration',
  'MatchChallenge',
  'Event',
  'PeladaCotinhaPayment',
  'PeladaCotinha',
  'PeladaMembershipFee',
  'PeladaCashEntry',
  'PeladaMembership',
  'Pelada',
  'AmateurTeamMembership',
  'AmateurTeam',
  'AppMessage',
  'MuralHighlightTenure',
  'AmateurLegendAthlete',
  'AmateurLegendTeam',
  'ProLegendAthlete',
  'AthleteProfile',
  'RoleProfile',
  'FanProfile',
  '_Installation',
  '_Session',
  '_User',
];

const PURGE_BATCH_SIZE = 200;
const PURGE_MAX_BATCHES_PER_CLASS = 40;

function getPurgeSecretFromEnv() {
  return String(process.env.PROD_PURGE_SECRET || '').trim();
}

function assertProdPurgeAuthorized(request) {
  const expected = getPurgeSecretFromEnv();
  if (!expected) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'PROD_PURGE_SECRET nao configurado no Back4App (Environment Variables).'
    );
  }
  const provided = String((request.params && request.params.secret) || '').trim();
  if (!provided || provided !== expected) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Secret de purge invalido.');
  }
}

function buildPurgeQuery(className, createdBefore) {
  const query = new Parse.Query(className);
  if (createdBefore instanceof Date && !Number.isNaN(createdBefore.getTime())) {
    query.lessThan('createdAt', createdBefore);
  }
  query.limit(PURGE_BATCH_SIZE);
  return query;
}

function isMissingClassError(error) {
  const code = error && error.code;
  const message = String((error && error.message) || '');
  return (
    code === Parse.Error.INVALID_CLASS_NAME ||
    /class .* does ?n'?o?t exist/i.test(message) ||
    /Class .* not found/i.test(message)
  );
}

async function countClassRows(className, createdBefore) {
  if (PURGE_SKIP_CLASSES.has(className)) {
    return { className, count: null, skipped: true, reason: 'protected' };
  }
  try {
    const query = new Parse.Query(className);
    if (createdBefore instanceof Date && !Number.isNaN(createdBefore.getTime())) {
      query.lessThan('createdAt', createdBefore);
    }
    const count = await query.count({ useMasterKey: true });
    return { className, count, skipped: false };
  } catch (error) {
    if (isMissingClassError(error)) {
      return { className, count: 0, skipped: true, reason: 'missing_class' };
    }
    throw error;
  }
}

async function deleteClassBatch(className, createdBefore) {
  if (PURGE_SKIP_CLASSES.has(className)) {
    return { className, deleted: 0, batches: 0, skipped: true, reason: 'protected' };
  }

  let deleted = 0;
  let batches = 0;

  try {
    for (let i = 0; i < PURGE_MAX_BATCHES_PER_CLASS; i += 1) {
      const rows = await buildPurgeQuery(className, createdBefore).find({ useMasterKey: true });
      if (!rows.length) {
        break;
      }
      batches += 1;
      await Parse.Object.destroyAll(rows, { useMasterKey: true });
      deleted += rows.length;
      if (rows.length < PURGE_BATCH_SIZE) {
        break;
      }
    }
  } catch (error) {
    if (isMissingClassError(error)) {
      return { className, deleted: 0, batches: 0, skipped: true, reason: 'missing_class' };
    }
    throw error;
  }

  const remaining = await countClassRows(className, createdBefore);
  return {
    className,
    deleted,
    batches,
    skipped: false,
    remaining: remaining.count,
  };
}

function resolveCreatedBefore(params) {
  const wipeAll = params.wipeAll === true || params.wipeAll === 'true';
  if (wipeAll) {
    return null;
  }
  const raw = String(params.createdBefore || '').trim();
  if (!raw) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe wipeAll:true ou createdBefore (ISO).'
    );
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'createdBefore invalido (use ISO 8601).');
  }
  return date;
}

function assertDestructiveConfirmation(params, dryRun) {
  if (dryRun) {
    return;
  }
  const phrase = String(params.confirmPhrase || '').trim();
  if (phrase !== 'DELETE_ALL_TEST_DATA') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Para apagar de verdade envie confirmPhrase: DELETE_ALL_TEST_DATA.'
    );
  }
}

Parse.Cloud.define('prodDataPurgeInventory', async (request) => {
  assertProdPurgeAuthorized(request);
  const createdBefore = resolveCreatedBefore(request.params || {});
  const rows = [];
  for (const className of PURGE_CLASS_ORDER) {
    rows.push(await countClassRows(className, createdBefore));
  }
  for (const className of PURGE_SKIP_CLASSES) {
    rows.push(await countClassRows(className, createdBefore));
  }
  return {
    ok: true,
    dryRun: true,
    wipeAll: createdBefore == null,
    createdBefore: createdBefore ? createdBefore.toISOString() : null,
    classes: rows,
  };
});

Parse.Cloud.define('prodDataPurge', async (request) => {
  assertProdPurgeAuthorized(request);
  const params = request.params || {};
  const dryRun = !(params.dryRun === false || params.dryRun === 'false');
  const createdBefore = resolveCreatedBefore(params);
  assertDestructiveConfirmation(params, dryRun);

  const startAt = params.startAtClass
    ? String(params.startAtClass).trim()
    : PURGE_CLASS_ORDER[0];
  const startIndex = Math.max(0, PURGE_CLASS_ORDER.indexOf(startAt));
  if (startIndex < 0) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'startAtClass desconhecido.');
  }

  const steps = [];
  for (let i = startIndex; i < PURGE_CLASS_ORDER.length; i += 1) {
    const className = PURGE_CLASS_ORDER[i];
    if (dryRun) {
      const counted = await countClassRows(className, createdBefore);
      steps.push({
        className,
        deleted: 0,
        batches: 0,
        skipped: counted.skipped,
        reason: counted.reason,
        remaining: counted.count,
      });
    } else {
      steps.push(await deleteClassBatch(className, createdBefore));
    }
  }

  const stuck = steps.find((s) => !s.skipped && Number(s.remaining) > 0);
  const nextClass = stuck ? stuck.className : null;

  return {
    ok: true,
    dryRun,
    wipeAll: createdBefore == null,
    createdBefore: createdBefore ? createdBefore.toISOString() : null,
    steps,
    hint: nextClass
      ? `Ainda ha registros em ${nextClass}. Rode de novo com startAtClass ou repita ate remaining=0.`
      : 'Rodada concluida. Confira prodDataPurgeInventory.',
  };
});

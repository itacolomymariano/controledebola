/** Legendas amadoras e profissionais */

/** Legendas amadoras e profissionais */

const LEGEND_ATHLETE_RELATIONSHIPS = ['pai', 'filho', 'irmao', 'amigo', 'admirador'];
const LEGEND_TEAM_RELATIONSHIPS = ['ex_atleta', 'presidente', 'diretor', 'torcedor', 'amigo', 'admirador'];

function legendPublicAcl(user) {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  if (user) {
    acl.setWriteAccess(user, true);
  }
  return acl;
}

function parseOptionalDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapLegendAthleteRow(row) {
  const registeredBy = row.get('registeredByUser');
  return {
    id: row.id,
    name: row.get('name') || '',
    apelido: row.get('apelido') || '',
    imageUrl: row.get('imageUrl') || undefined,
    address: row.get('address') || undefined,
    birthDate: row.get('birthDate') ? row.get('birthDate').toISOString() : undefined,
    careerEndYear: row.get('careerEndYear') ?? undefined,
    amateurTeams: row.get('amateurTeams') || [],
    position: row.get('position') || undefined,
    inMemoriam: !!row.get('inMemoriam'),
    memorialDate: row.get('memorialDate') ? row.get('memorialDate').toISOString() : undefined,
    relationship: row.get('relationship') || 'admirador',
    registeredByUserId: registeredBy ? registeredBy.id : undefined,
    registeredByName: row.get('registeredByName') || undefined,
    registeredAt: row.get('registeredAt') ? row.get('registeredAt').toISOString() : undefined,
  };
}

function formatAthleteRefPickerSubtitle(position, age, state, city, neighborhood) {
  const parts = [];
  if (position) parts.push(String(position).trim());
  if (age != null && age >= 0) parts.push(`${age} anos`);
  const uf = String(state || '').trim();
  const cidade = String(city || '').trim();
  const bairro = String(neighborhood || '').trim();
  if (uf) parts.push(uf);
  if (cidade) parts.push(cidade);
  if (bairro) parts.push(bairro);
  return parts.length ? parts.join(' · ') : '';
}

function ageFromBirthDate(value) {
  if (!value) return null;
  const birth = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

function mapLegendTeamRow(row) {
  const registeredBy = row.get('registeredByUser');
  const president = row.get('presidentUser');
  return {
    id: row.id,
    name: row.get('name') || '',
    apelido: row.get('apelido') || '',
    imageUrl: row.get('imageUrl') || undefined,
    location: row.get('location') || undefined,
    foundedDate: row.get('foundedDate') ? row.get('foundedDate').toISOString() : undefined,
    endedDate: row.get('endedDate') ? row.get('endedDate').toISOString() : undefined,
    description: row.get('description') || undefined,
    relationship: row.get('relationship') || 'admirador',
    athleteRefs: row.get('athleteRefs') || [],
    presidentUserId: president && president.id ? president.id : undefined,
    registeredByUserId: registeredBy ? registeredBy.id : undefined,
    registeredByName: row.get('registeredByName') || undefined,
    registeredAt: row.get('registeredAt') ? row.get('registeredAt').toISOString() : undefined,
  };
}

async function applyLegendTeamPresidentName(row, target) {
  const president = row.get('presidentUser');
  if (!president || !president.id) return;
  target.presidentUserId = president.id;
  try {
    await president.fetch({ useMasterKey: true });
    const name = String(president.get('apelido') || president.get('name') || '').trim();
    if (name) target.presidentName = name;
  } catch {
    /* pointer only */
  }
}

async function resolveLegendTeamAthleteDisplay(ref) {
  const type = String(ref.type || '').trim();
  const id = String(ref.id || '').trim();
  const label = String(ref.label || '').trim();
  const fallback = {
    type,
    id,
    apelido: label || 'Atleta',
    imageUrl: undefined,
    age: null,
    inMemoriam: false,
  };
  if (!id) return fallback;

  if (type === 'legend_athlete') {
    const legendRow = await new Parse.Query('AmateurLegendAthlete')
      .get(id, { useMasterKey: true })
      .catch(() => null);
    if (!legendRow) return fallback;
    return {
      type,
      id,
      apelido: legendRow.get('apelido') || legendRow.get('name') || label || 'Atleta',
      imageUrl: legendRow.get('imageUrl') || undefined,
      age: ageFromBirthDate(legendRow.get('birthDate')),
      inMemoriam: !!legendRow.get('inMemoriam'),
    };
  }

  if (type === 'app_athlete') {
    const user = await new Parse.Query(Parse.User).get(id, { useMasterKey: true }).catch(() => null);
    if (!user) return fallback;
    return {
      type,
      id,
      apelido: user.get('apelido') || user.get('name') || label || 'Atleta',
      imageUrl: user.get('avatarUrl') || undefined,
      age: ageFromBirthDate(user.get('birthDate')),
      inMemoriam: false,
    };
  }

  return fallback;
}

async function resolveLegendTeamAthletesBatch(refs) {
  const normalized = normalizeAthleteRefs(refs);
  if (!normalized.length) return [];

  const legendIds = normalized.filter((ref) => ref.type === 'legend_athlete').map((ref) => ref.id);
  const appIds = normalized.filter((ref) => ref.type === 'app_athlete').map((ref) => ref.id);

  const legendById = new Map();
  if (legendIds.length) {
    const legendQuery = new Parse.Query('AmateurLegendAthlete');
    legendQuery.containedIn('objectId', legendIds);
    legendQuery.limit(legendIds.length);
    const legendRows = await legendQuery.find({ useMasterKey: true });
    for (const legendRow of legendRows) {
      legendById.set(legendRow.id, legendRow);
    }
  }

  const userById = new Map();
  if (appIds.length) {
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', appIds);
    userQuery.limit(appIds.length);
    const users = await userQuery.find({ useMasterKey: true });
    for (const user of users) {
      if (user.id) userById.set(user.id, user);
    }
  }

  return normalized.map((ref) => {
    const label = String(ref.label || '').trim();
    const fallback = {
      type: String(ref.type || '').trim(),
      id: String(ref.id || '').trim(),
      apelido: label || 'Atleta',
      imageUrl: undefined,
      age: null,
      inMemoriam: false,
    };
    if (ref.type === 'legend_athlete') {
      const legendRow = legendById.get(ref.id);
      if (!legendRow) return fallback;
      return {
        type: ref.type,
        id: ref.id,
        apelido: legendRow.get('apelido') || legendRow.get('name') || label || 'Atleta',
        imageUrl: legendRow.get('imageUrl') || undefined,
        age: ageFromBirthDate(legendRow.get('birthDate')),
        inMemoriam: !!legendRow.get('inMemoriam'),
      };
    }
    if (ref.type === 'app_athlete') {
      const user = userById.get(ref.id);
      if (!user) return fallback;
      return {
        type: ref.type,
        id: ref.id,
        apelido: user.get('apelido') || user.get('name') || label || 'Atleta',
        imageUrl: user.get('avatarUrl') || undefined,
        age: ageFromBirthDate(user.get('birthDate')),
        inMemoriam: false,
      };
    }
    return fallback;
  });
}

async function mapLegendTeamDetailRow(row) {
  const base = mapLegendTeamRow(row);
  await applyLegendTeamPresidentName(row, base);
  base.athletes = await resolveLegendTeamAthletesBatch(row.get('athleteRefs'));
  return base;
}

async function setLegendTeamPresidentUser(row, presidentUserId) {
  const id = String(presidentUserId || '').trim();
  if (!id) {
    row.unset('presidentUser');
    return;
  }
  const user = await new Parse.Query(Parse.User).get(id, { useMasterKey: true });
  row.set('presidentUser', user);
}

function normalizeLegendSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function legendHaystack(parts) {
  return normalizeLegendSearch(parts.filter(Boolean).join(' '));
}

async function findExistingLegendByName(className, name, apelido) {
  const needles = [normalizeLegendSearch(name), normalizeLegendSearch(apelido)].filter(
    (value) => value.length >= 2
  );
  if (!needles.length) return null;
  const rows = await new Parse.Query(className).limit(200).find({ useMasterKey: true });
  return (
    rows.find((row) => {
      const names = [normalizeLegendSearch(row.get('name')), normalizeLegendSearch(row.get('apelido'))];
      return needles.some((needle) => names.includes(needle));
    }) || null
  );
}

async function findExistingLegendByNameExcluding(className, name, apelido, excludeId) {
  const existing = await findExistingLegendByName(className, name, apelido);
  if (!existing) return null;
  if (excludeId && existing.id === excludeId) return null;
  return existing;
}

function assertLegendRegisteredBy(row, user) {
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const registeredBy = row.get('registeredByUser');
  if (!registeredBy || registeredBy.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Somente quem cadastrou pode editar esta lenda.'
    );
  }
}

function normalizeAthleteRefs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((ref) => ({
      type: String(ref.type || '').trim(),
      id: String(ref.id || '').trim(),
      label: String(ref.label || '').trim(),
    }))
    .filter((ref) => ref.id.length && (ref.type === 'app_athlete' || ref.type === 'legend_athlete'));
}

Parse.Cloud.define('createAmateurLegendAthlete', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome da lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido da lenda.');
  }
  if (!LEGEND_ATHLETE_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com a lenda invalida.');
  }

  const existingAthlete = await findExistingLegendByName('AmateurLegendAthlete', name, apelido);
  if (existingAthlete) {
    const label = existingAthlete.get('apelido') || existingAthlete.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe a lenda "${label}". Use o cadastro existente em Lendas.`
    );
  }

  const row = new Parse.Object('AmateurLegendAthlete');
  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set('amateurTeams', Array.isArray(request.params.amateurTeams) ? request.params.amateurTeams.map(String) : []);
  row.set('inMemoriam', !!request.params.inMemoriam);
  row.set('registeredByUser', user);
  row.set('registeredByName', user.get('apelido') || user.get('name') || user.getUsername());
  row.set('registeredAt', new Date());

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.address) row.set('address', request.params.address);
  if (request.params.position) row.set('position', String(request.params.position).trim());
  if (request.params.careerEndYear != null) row.set('careerEndYear', Number(request.params.careerEndYear));

  const birthDate = parseOptionalDate(request.params.birthDate);
  if (birthDate) row.set('birthDate', birthDate);

  const memorialDate = parseOptionalDate(request.params.memorialDate);
  if (memorialDate) row.set('memorialDate', memorialDate);

  row.setACL(legendPublicAcl(user));
  await row.save(null, { useMasterKey: true });
  return mapLegendAthleteRow(row);
});

Parse.Cloud.define('createAmateurLegendTeam', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome do time lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido do time lenda.');
  }
  if (!LEGEND_TEAM_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com o time lenda invalida.');
  }

  const existingTeam = await findExistingLegendByName('AmateurLegendTeam', name, apelido);
  if (existingTeam) {
    const label = existingTeam.get('apelido') || existingTeam.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe o time lenda "${label}". Use o cadastro existente em Lendas.`
    );
  }

  const row = new Parse.Object('AmateurLegendTeam');
  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  const createAthleteRefs = normalizeAthleteRefs(request.params.athleteRefs);
  row.set('athleteRefs', createAthleteRefs);
  row.set('registeredByUser', user);
  row.set('registeredByName', user.get('apelido') || user.get('name') || user.getUsername());
  row.set('registeredAt', new Date());

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.location) row.set('location', request.params.location);
  if (request.params.description) row.set('description', String(request.params.description).trim());

  const foundedDate = parseOptionalDate(request.params.foundedDate);
  if (foundedDate) row.set('foundedDate', foundedDate);
  const endedDate = parseOptionalDate(request.params.endedDate);
  if (endedDate) row.set('endedDate', endedDate);

  if (request.params.presidentUserId !== undefined) {
    await setLegendTeamPresidentUser(row, request.params.presidentUserId);
  }

  row.setACL(legendPublicAcl(user));
  await row.save(null, { useMasterKey: true });
  if (typeof syncAthletePlayedLinksForLegendTeamChange === 'function') {
    await syncAthletePlayedLinksForLegendTeamChange(row, [], createAthleteRefs);
  }
  return mapLegendTeamRow(row);
});

Parse.Cloud.define('updateAmateurLegendAthlete', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }

  const row = await new Parse.Query('AmateurLegendAthlete').get(id, { useMasterKey: true });
  assertLegendRegisteredBy(row, user);

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome da lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido da lenda.');
  }
  if (!LEGEND_ATHLETE_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com a lenda invalida.');
  }

  const existingAthlete = await findExistingLegendByNameExcluding(
    'AmateurLegendAthlete',
    name,
    apelido,
    id
  );
  if (existingAthlete) {
    const label = existingAthlete.get('apelido') || existingAthlete.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe a lenda "${label}". Use o cadastro existente em Lendas.`
    );
  }

  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set(
    'amateurTeams',
    Array.isArray(request.params.amateurTeams) ? request.params.amateurTeams.map(String) : []
  );
  row.set('inMemoriam', !!request.params.inMemoriam);

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.address) row.set('address', request.params.address);
  if (request.params.position) row.set('position', String(request.params.position).trim());
  if (request.params.careerEndYear != null) row.set('careerEndYear', Number(request.params.careerEndYear));

  const birthDate = parseOptionalDate(request.params.birthDate);
  if (birthDate) row.set('birthDate', birthDate);

  const memorialDate = parseOptionalDate(request.params.memorialDate);
  if (memorialDate) row.set('memorialDate', memorialDate);

  await row.save(null, { useMasterKey: true });
  return mapLegendAthleteRow(row);
});

Parse.Cloud.define('updateAmateurLegendTeam', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }

  const row = await new Parse.Query('AmateurLegendTeam').get(id, { useMasterKey: true });
  assertLegendRegisteredBy(row, user);

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome do time lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido do time lenda.');
  }
  if (!LEGEND_TEAM_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com o time lenda invalida.');
  }

  const existingTeam = await findExistingLegendByNameExcluding(
    'AmateurLegendTeam',
    name,
    apelido,
    id
  );
  if (existingTeam) {
    const label = existingTeam.get('apelido') || existingTeam.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe o time lenda "${label}". Use o cadastro existente em Lendas.`
    );
  }

  const previousRefs = row.get('athleteRefs');
  const nextAthleteRefs = normalizeAthleteRefs(request.params.athleteRefs);

  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set('athleteRefs', nextAthleteRefs);

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.location) row.set('location', request.params.location);
  if (request.params.description !== undefined) {
    row.set('description', String(request.params.description || '').trim());
  }

  const foundedDate = parseOptionalDate(request.params.foundedDate);
  if (foundedDate) row.set('foundedDate', foundedDate);
  const endedDate = parseOptionalDate(request.params.endedDate);
  if (endedDate) row.set('endedDate', endedDate);

  if (request.params.presidentUserId !== undefined) {
    await setLegendTeamPresidentUser(row, request.params.presidentUserId);
  }

  await row.save(null, { useMasterKey: true });
  if (typeof syncAthletePlayedLinksForLegendTeamChange === 'function') {
    await syncAthletePlayedLinksForLegendTeamChange(row, previousRefs, nextAthleteRefs);
  }
  return mapLegendTeamRow(row);
});

Parse.Cloud.define('listAmateurLegendAthletes', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const query = new Parse.Query('AmateurLegendAthlete');
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows
    .map(mapLegendAthleteRow)
    .filter((row) => {
      if (!search) return true;
      return legendHaystack([row.name, row.apelido, ...(row.amateurTeams || [])]).includes(search);
    });
});

Parse.Cloud.define('listAmateurLegendTeams', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const query = new Parse.Query('AmateurLegendTeam');
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows
    .map(mapLegendTeamRow)
    .filter((row) => {
      if (!search) return true;
      return legendHaystack([row.name, row.apelido, row.description]).includes(search);
    });
});

function mapHomeDirectoryLegendTeamRow(row) {
  const apelido = String(row.get('apelido') || '').trim();
  const name = String(row.get('name') || '').trim();
  const location = row.get('location') || {};
  return {
    objectId: row.id,
    name: apelido || name,
    subtitle: apelido && name && apelido !== name ? name : undefined,
    imageUrl: row.get('imageUrl') || undefined,
    homeVenueAddress: {
      street: String(location.street || ''),
      neighborhood: String(location.neighborhood || ''),
      city: String(location.city || ''),
      state: String(location.state || ''),
      zipCode: String(location.zipCode || ''),
      latitude: typeof location.latitude === 'number' ? location.latitude : undefined,
      longitude: typeof location.longitude === 'number' ? location.longitude : undefined,
    },
  };
}

Parse.Cloud.define('listHomeDirectoryLegendTeams', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const limit = Math.min(Math.max(Number(request.params.limit) || 400, 1), 400);
  const query = new Parse.Query('AmateurLegendTeam');
  query.ascending('apelido');
  query.limit(limit);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapHomeDirectoryLegendTeamRow);
});

Parse.Cloud.define('getAmateurLegendAthlete', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }
  const row = await new Parse.Query('AmateurLegendAthlete').get(id, { useMasterKey: true });
  return mapLegendAthleteRow(row);
});

Parse.Cloud.define('getAmateurLegendTeam', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }
  const row = await new Parse.Query('AmateurLegendTeam').get(id, { useMasterKey: true });
  return mapLegendTeamDetailRow(row);
});

Parse.Cloud.define('suggestAmateurFootballIdols', async (request) => {
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];
  const seen = new Set();

  function pushSuggestion(item) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return;
    if (!matchesLegendSearch(`${item.label} ${item.subtitle || ''}`, search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  const fetchLimit = search ? 200 : limit;
  const legendQuery = new Parse.Query('AmateurLegendAthlete');
  legendQuery.descending('createdAt');
  legendQuery.limit(fetchLimit);
  for (const row of await legendQuery.find({ useMasterKey: true })) {
    pushSuggestion({
      id: row.id,
      label: row.get('apelido') || row.get('name'),
      subtitle: row.get('name'),
      source: 'legend_athlete',
      imageUrl: row.get('imageUrl') || undefined,
    });
    if (suggestions.length >= limit) break;
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.include('user');
  athleteQuery.limit(fetchLimit);
  for (const profile of await athleteQuery.find({ useMasterKey: true })) {
    const profileUser = profile.get('user');
    if (!profileUser) continue;
    const fullUser = profileUser.id
      ? await new Parse.Query(Parse.User).get(profileUser.id, { useMasterKey: true }).catch(() => null)
      : null;
    const apelido = fullUser?.get('apelido') || fullUser?.get('name') || 'Atleta';
    pushSuggestion({
      id: fullUser?.id || profile.id,
      label: apelido,
      subtitle: 'Atleta no app',
      source: 'app_athlete',
      imageUrl: fullUser?.get('avatarUrl') || undefined,
    });
    if (suggestions.length >= limit * 2) break;
  }

  return suggestions.slice(0, limit);
});

function mapProLegendAthleteRow(row) {
  const registeredBy = row.get('registeredByUser');
  return {
    id: row.id,
    name: row.get('name') || '',
    apelido: row.get('apelido') || '',
    imageUrl: row.get('imageUrl') || undefined,
    address: row.get('address') || undefined,
    birthDate: row.get('birthDate') ? row.get('birthDate').toISOString() : undefined,
    careerEndYear: row.get('careerEndYear') ?? undefined,
    proTeams: row.get('proTeams') || [],
    position: row.get('position') || undefined,
    inMemoriam: !!row.get('inMemoriam'),
    memorialDate: row.get('memorialDate') ? row.get('memorialDate').toISOString() : undefined,
    relationship: row.get('relationship') || 'admirador',
    registeredByUserId: registeredBy ? registeredBy.id : undefined,
    registeredByName: row.get('registeredByName') || undefined,
    registeredAt: row.get('registeredAt') ? row.get('registeredAt').toISOString() : undefined,
  };
}

Parse.Cloud.define('createProLegendAthlete', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome da lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido da lenda.');
  }
  if (!LEGEND_ATHLETE_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com a lenda invalida.');
  }

  const existingPro = await findExistingLegendByName('ProLegendAthlete', name, apelido);
  if (existingPro) {
    const label = existingPro.get('apelido') || existingPro.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe a lenda profissional "${label}". Use o cadastro existente.`
    );
  }

  const row = new Parse.Object('ProLegendAthlete');
  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set('proTeams', Array.isArray(request.params.proTeams) ? request.params.proTeams.map(String) : []);
  row.set('inMemoriam', !!request.params.inMemoriam);
  row.set('registeredByUser', user);
  row.set('registeredByName', user.get('apelido') || user.get('name') || user.getUsername());
  row.set('registeredAt', new Date());

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.address) row.set('address', request.params.address);
  if (request.params.position) row.set('position', String(request.params.position).trim());
  if (request.params.careerEndYear != null) row.set('careerEndYear', Number(request.params.careerEndYear));

  const birthDate = parseOptionalDate(request.params.birthDate);
  if (birthDate) row.set('birthDate', birthDate);

  const memorialDate = parseOptionalDate(request.params.memorialDate);
  if (memorialDate) row.set('memorialDate', memorialDate);

  row.setACL(legendPublicAcl(user));
  await row.save(null, { useMasterKey: true });
  return mapProLegendAthleteRow(row);
});

Parse.Cloud.define('listProLegendAthletes', async (request) => {
  const search = normalizeLegendSearch(request.params.search);
  const query = new Parse.Query('ProLegendAthlete');
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows
    .map(mapProLegendAthleteRow)
    .filter((row) => {
      if (!search) return true;
      return legendHaystack([row.name, row.apelido, ...(row.proTeams || [])]).includes(search);
    });
});

Parse.Cloud.define('getProLegendAthlete', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }
  const row = await new Parse.Query('ProLegendAthlete').get(id, { useMasterKey: true });
  return mapProLegendAthleteRow(row);
});

Parse.Cloud.define('suggestProFootballIdols', async (request) => {
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];
  const seen = new Set();

  function pushSuggestion(item) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return;
    if (!matchesLegendSearch(`${item.label} ${item.subtitle || ''}`, search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  const fetchLimit = search ? 200 : limit;
  const legendQuery = new Parse.Query('ProLegendAthlete');
  legendQuery.descending('createdAt');
  legendQuery.limit(fetchLimit);
  for (const row of await legendQuery.find({ useMasterKey: true })) {
    pushSuggestion({
      id: row.id,
      label: row.get('apelido') || row.get('name'),
      subtitle: row.get('name'),
      source: 'legend_pro_athlete',
      imageUrl: row.get('imageUrl') || undefined,
    });
    if (suggestions.length >= limit) break;
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.include('user');
  athleteQuery.limit(fetchLimit);
  for (const profile of await athleteQuery.find({ useMasterKey: true })) {
    const profileUser = profile.get('user');
    if (!profileUser) continue;
    const fullUser = profileUser.id
      ? await new Parse.Query(Parse.User).get(profileUser.id, { useMasterKey: true }).catch(() => null)
      : null;
    const apelido = fullUser?.get('apelido') || fullUser?.get('name') || 'Atleta';
    pushSuggestion({
      id: fullUser?.id || profile.id,
      label: apelido,
      subtitle: 'Atleta no app',
      source: 'app_athlete',
      imageUrl: fullUser?.get('avatarUrl') || undefined,
    });
    if (suggestions.length >= limit * 2) break;
  }

  return suggestions.slice(0, limit);
});

function amateurTeamImageUrl(row) {
  const direct = String(row.get('teamImageUrl') || '').trim();
  if (direct) return direct;
  const file = row.get('teamImage');
  if (file && typeof file.url === 'function') {
    try {
      return file.url() || undefined;
    } catch {
      return undefined;
    }
  }
  if (file && file._url) return file._url;
  return undefined;
}

function matchesLegendSearch(haystack, search) {
  if (!search) return true;
  return normalizeLegendSearch(haystack).includes(search);
}

Parse.Cloud.define('suggestFavoritePeladaTeams', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];
  const seen = new Set();

  function pushSuggestion(item) {
    const key = `${item.source}:${item.id}:${String(item.label || '')
      .trim()
      .toLowerCase()}`;
    if (seen.has(key)) return;
    if (!matchesLegendSearch(`${item.label} ${item.subtitle || ''}`, search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  // Prioriza cadastro de Times Amadores (AmateurTeam), com varredura ampla por nome.
  const amateurTeamQuery = new Parse.Query('AmateurTeam');
  amateurTeamQuery.ascending('name');
  amateurTeamQuery.limit(500);
  for (const row of await amateurTeamQuery.find({ useMasterKey: true })) {
    const name = String(row.get('name') || '').trim();
    if (!name) continue;
    pushSuggestion({
      id: row.id,
      label: name,
      subtitle: 'Time amador no app',
      source: 'app_team',
      imageUrl: amateurTeamImageUrl(row),
    });
  }

  const legendTeamQuery = new Parse.Query('AmateurLegendTeam');
  legendTeamQuery.descending('createdAt');
  legendTeamQuery.limit(500);
  for (const row of await legendTeamQuery.find({ useMasterKey: true })) {
    const label = String(row.get('apelido') || row.get('name') || '').trim();
    if (!label) continue;
    pushSuggestion({
      id: row.id,
      label,
      subtitle: 'Time lenda',
      source: 'legend_team',
      imageUrl: row.get('imageUrl') || undefined,
    });
  }

  const fanQuery = new Parse.Query('FanProfile');
  fanQuery.exists('favoritePeladaTeam');
  fanQuery.limit(500);
  for (const row of await fanQuery.find({ useMasterKey: true })) {
    const label = String(row.get('favoritePeladaTeam') || '').trim();
    if (!label) continue;
    pushSuggestion({
      id: label,
      label,
      subtitle: 'Time citado por torcedores',
      source: 'pelada_team_text',
    });
  }

  // Tambem considera favoriteAmateurTeam ja gravado em usuarios (cadastros livres).
  if (search) {
    const userTeamQuery = new Parse.Query(Parse.User);
    userTeamQuery.exists('favoriteAmateurTeam');
    userTeamQuery.limit(500);
    for (const user of await userTeamQuery.find({ useMasterKey: true })) {
      const label = String(user.get('favoriteAmateurTeam') || '').trim();
      if (!label) continue;
      pushSuggestion({
        id: `user-team:${label.toLowerCase()}`,
        label,
        subtitle: 'Time amador citado no app',
        source: 'pelada_team_text',
      });
    }
  }

  return suggestions.slice(0, limit);
});

Parse.Cloud.define('searchLegendAthleteRefs', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];

  const legendQuery = new Parse.Query('AmateurLegendAthlete');
  legendQuery.limit(limit);
  for (const row of await legendQuery.find({ useMasterKey: true })) {
    const label = row.get('apelido') || row.get('name');
    const haystack = `${label} ${row.get('name')} ${row.get('position') || ''}`.toLowerCase();
    if (search && !haystack.includes(search)) continue;
    const addr = row.get('address') || {};
    const subtitle =
      formatAthleteRefPickerSubtitle(
        row.get('position'),
        ageFromBirthDate(row.get('birthDate')),
        addr.state,
        addr.city,
        addr.neighborhood
      ) || 'Lenda cadastrada';
    suggestions.push({
      id: row.id,
      label,
      subtitle,
      source: 'legend_athlete',
      imageUrl: row.get('imageUrl') || undefined,
    });
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.include('user');
  athleteQuery.limit(Math.min(limit * 10, 200));
  for (const profile of await athleteQuery.find({ useMasterKey: true })) {
    const profileUser = profile.get('user');
    if (!profileUser?.id) continue;
    const fullUser = await new Parse.Query(Parse.User)
      .get(profileUser.id, { useMasterKey: true })
      .catch(() => null);
    if (!fullUser) continue;
    const label = fullUser.get('apelido') || fullUser.get('name') || 'Atleta';
    const haystack = `${label} ${fullUser.get('name') || ''} ${
      profile.get('primaryPosition') || ''
    }`.toLowerCase();
    if (search && !haystack.includes(search)) continue;
    const addr = fullUser.get('address') || {};
    const subtitle =
      formatAthleteRefPickerSubtitle(
        profile.get('primaryPosition'),
        ageFromBirthDate(fullUser.get('birthDate')),
        addr.state,
        addr.city,
        addr.neighborhood
      ) || 'Atleta no app';
    suggestions.push({
      id: fullUser.id,
      label,
      subtitle,
      source: 'app_athlete',
      imageUrl:
        profile.get('userAvatarUrl') || fullUser.get('avatarUrl') || undefined,
    });
  }

  return suggestions.slice(0, limit);
});

function locationProximityScoreForLegend(addressA, addressB) {
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const stateA = normalize(addressA && addressA.state);
  const stateB = normalize(addressB && addressB.state);
  const cityA = normalize(addressA && addressA.city);
  const cityB = normalize(addressB && addressB.city);
  const neighborhoodA = normalize(addressA && addressA.neighborhood);
  const neighborhoodB = normalize(addressB && addressB.neighborhood);
  let score = 0;
  if (stateA && stateB && stateA === stateB) score += 1;
  if (cityA && cityB && cityA === cityB) score += 3;
  if (neighborhoodA && neighborhoodB && neighborhoodA === neighborhoodB) score += 5;
  return score;
}

async function searchActiveAmateurTeamsForPicker(search, address, limit) {
  const rows = await new Parse.Query('AmateurTeam').limit(200).find({ useMasterKey: true });
  const results = [];

  for (const row of rows) {
    const name = String(row.get('name') || '').trim();
    if (!name) continue;
    if (search && !normalizeLegendSearch(name).includes(search)) continue;

    let presidentAddress = {};
    const president = row.get('president');
    if (president && president.id) {
      try {
        const user = await new Parse.Query(Parse.User).get(president.id, { useMasterKey: true });
        presidentAddress = user.get('address') || {};
      } catch {
        presidentAddress = {};
      }
    }

    const teamImage = row.get('teamImage');
    let averageAge = null;
    try {
      if (typeof amateurTeamAverageAge === 'function') {
        averageAge = await amateurTeamAverageAge(row.id);
      }
    } catch {
      averageAge = null;
    }
    results.push({
      id: row.id,
      name,
      kind: 'active',
      imageUrl: teamImage && teamImage.url ? teamImage.url() : undefined,
      averageAge,
      proximityScore: locationProximityScoreForLegend(address, presidentAddress),
    });
  }

  results.sort(
    (a, b) =>
      b.proximityScore - a.proximityScore || a.name.localeCompare(b.name, 'pt-BR')
  );
  return results.slice(0, limit).map(({ proximityScore, averageAge, ...item }) => ({
    ...item,
    averageAge: averageAge ?? undefined,
  }));
}

async function searchLegendTeamsForPicker(search, address, limit) {
  const rows = await new Parse.Query('AmateurLegendTeam').limit(200).find({ useMasterKey: true });
  const results = [];

  for (const row of rows) {
    const apelido = String(row.get('apelido') || '').trim();
    const fullName = String(row.get('name') || '').trim();
    const label = apelido || fullName;
    if (!label) continue;
    if (search && !legendHaystack([fullName, apelido, row.get('description')]).includes(search)) {
      continue;
    }
    const teamLocation = row.get('location') || {};
    results.push({
      id: row.id,
      name: label,
      kind: 'legend',
      imageUrl: row.get('imageUrl') || undefined,
      subtitle: apelido && fullName && apelido !== fullName ? fullName : undefined,
      proximityScore: locationProximityScoreForLegend(address, teamLocation),
    });
  }

  results.sort(
    (a, b) =>
      b.proximityScore - a.proximityScore || a.name.localeCompare(b.name, 'pt-BR')
  );
  return results.slice(0, limit).map(({ proximityScore, ...item }) => item);
}

const LEGEND_TEAM_JOIN_REQUEST_CLASS = 'LegendTeamJoinRequest';

function legendTeamJoinRecipientIds(teamRow) {
  const ids = [];
  const registeredBy = teamRow.get('registeredByUser');
  if (registeredBy && registeredBy.id) ids.push(registeredBy.id);
  const president = teamRow.get('presidentUser');
  if (president && president.id && !ids.includes(president.id)) ids.push(president.id);
  return ids;
}

function userAlreadyOnLegendTeamRoster(refs, userId) {
  const normalized = normalizeAthleteRefs(refs);
  return normalized.some((ref) => ref.type === 'app_athlete' && ref.id === userId);
}

function mapLegendTeamJoinRequestRow(row) {
  const legendTeam = row.get('legendTeam');
  const athlete = row.get('athlete');
  return {
    objectId: row.id,
    status: String(row.get('status') || 'pending'),
    legendTeamId: legendTeam && legendTeam.id ? legendTeam.id : '',
    teamName: String(row.get('teamName') || ''),
    athleteUserId: athlete && athlete.id ? athlete.id : '',
    athleteApelido: String(row.get('athleteApelido') || ''),
    athleteFullName: String(row.get('athleteFullName') || ''),
    athleteAvatarUrl: row.get('athleteAvatarUrl') || undefined,
    message: String(row.get('message') || ''),
    declineReason: String(row.get('declineReason') || ''),
    createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : null,
    respondedAt: row.get('respondedAt') ? row.get('respondedAt').toISOString() : null,
    alreadyOnRoster: !!row.get('alreadyOnRoster'),
  };
}

async function userCanRespondLegendTeamJoin(teamRow, user) {
  if (!user || !user.id) return false;
  return legendTeamJoinRecipientIds(teamRow).includes(user.id);
}

Parse.Cloud.define('requestLegendTeamJoin', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const legendTeamId = String(request.params.legendTeamId || request.params.teamId || '').trim();
  const message = String(request.params.message || '').trim().slice(0, 500);
  if (!legendTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time lenda.');
  }

  const teamRow = await new Parse.Query('AmateurLegendTeam')
    .include('registeredByUser')
    .include('presidentUser')
    .get(legendTeamId, { useMasterKey: true });

  const recipientIds = legendTeamJoinRecipientIds(teamRow);
  if (!recipientIds.length) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time lenda sem responsavel cadastrado.');
  }
  if (recipientIds.includes(user.id)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Voce ja e responsavel por este time lenda.');
  }
  if (userAlreadyOnLegendTeamRoster(teamRow.get('athleteRefs'), user.id)) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Voce ja consta no elenco deste time.');
  }

  const teamPtr = Parse.Object.extend('AmateurLegendTeam').createWithoutData(legendTeamId);
  const duplicate = await new Parse.Query(LEGEND_TEAM_JOIN_REQUEST_CLASS)
    .equalTo('legendTeam', teamPtr)
    .equalTo('athlete', user)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Ja existe uma solicitacao pendente.');
  }

  try {
    await user.fetch({ useMasterKey: true });
  } catch {
    /* sessao */
  }
  const athleteApelido = String(user.get('apelido') || '').trim();
  const athleteFullName = String(user.get('name') || '').trim();
  const athleteAvatar = String(user.get('avatarUrl') || '').trim();
  const teamLabel = String(teamRow.get('apelido') || teamRow.get('name') || 'Time lenda');

  const row = new Parse.Object(LEGEND_TEAM_JOIN_REQUEST_CLASS);
  row.set('legendTeam', teamPtr);
  row.set('athlete', user);
  row.set('teamName', teamLabel);
  row.set('status', 'pending');
  row.set('message', message);
  row.set('athleteApelido', athleteApelido);
  row.set('athleteFullName', athleteFullName);
  row.set('recipientUserIds', recipientIds);
  if (athleteAvatar) row.set('athleteAvatarUrl', athleteAvatar);

  const acl = new Parse.ACL();
  acl.setReadAccess(user.id, true);
  acl.setWriteAccess(user.id, true);
  for (const recipientId of recipientIds) {
    acl.setReadAccess(recipientId, true);
    acl.setWriteAccess(recipientId, true);
  }
  row.setACL(acl);
  await row.save(null, { useMasterKey: true });

  if (typeof createAppMessage === 'function') {
    const athleteName = athleteApelido || athleteFullName || 'Um atleta';
    for (const recipientId of recipientIds) {
      await createAppMessage({
        recipientId,
        senderId: user.id,
        kind: 'legend_team_join_request',
        title: `Pedido para entrar no time lenda ${teamLabel}`,
        body: `${athleteName} pediu para participar do elenco de "${teamLabel}". Autorize ou recuse na Entrada.`,
        relatedClass: LEGEND_TEAM_JOIN_REQUEST_CLASS,
        relatedId: row.id,
        actionRoute: '/inbox',
      });
    }
    await createAppMessage({
      recipientId: user.id,
      senderId: user.id,
      kind: 'legend_team_join_outbox',
      title: `Solicitacao enviada — ${teamLabel}`,
      body: `Seu pedido para participar de "${teamLabel}" foi enviado aos responsaveis.`,
      relatedClass: LEGEND_TEAM_JOIN_REQUEST_CLASS,
      relatedId: row.id,
      actionRoute: `/legends/team/${legendTeamId}`,
    });
  }

  return mapLegendTeamJoinRequestRow(row);
});

Parse.Cloud.define('respondLegendTeamJoin', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const requestId = String(request.params.requestId || '').trim();
  const decision = String(request.params.decision || '').trim();
  const declineReason = String(request.params.declineReason || '').trim().slice(0, 500);
  if (!requestId || (decision !== 'accepted' && decision !== 'declined')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a solicitacao e a decisao.');
  }

  const row = await new Parse.Query(LEGEND_TEAM_JOIN_REQUEST_CLASS)
    .include('legendTeam')
    .include('athlete')
    .get(requestId, { useMasterKey: true });
  const teamRow = row.get('legendTeam');
  if (!teamRow || !teamRow.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao incompleta.');
  }
  const teamFull = await new Parse.Query('AmateurLegendTeam')
    .include('registeredByUser')
    .include('presidentUser')
    .get(teamRow.id, { useMasterKey: true });

  if (!(await userCanRespondLegendTeamJoin(teamFull, user))) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Voce nao pode responder esta solicitacao.');
  }

  const status = String(row.get('status') || '');
  const athlete = row.get('athlete');
  const teamName = String(row.get('teamName') || 'Time lenda');

  if (status !== 'pending') {
    if (decision === 'accepted' && userAlreadyOnLegendTeamRoster(teamFull.get('athleteRefs'), athlete?.id)) {
      return mapLegendTeamJoinRequestRow(row);
    }
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Esta solicitacao ja foi respondida.');
  }

  row.set('respondedAt', new Date());

  if (decision === 'declined') {
    row.set('status', 'declined');
    row.set('declineReason', declineReason);
    await row.save(null, { useMasterKey: true });
    if (typeof createAppMessage === 'function' && athlete && athlete.id) {
      await createAppMessage({
        recipientId: athlete.id,
        senderId: user.id,
        kind: 'legend_team_join_declined',
        title: `Pedido recusado — ${teamName}`,
        body: declineReason
          ? `Seu pedido para "${teamName}" foi recusado: ${declineReason}`
          : `Seu pedido para participar de "${teamName}" foi recusado.`,
        relatedClass: LEGEND_TEAM_JOIN_REQUEST_CLASS,
        relatedId: row.id,
        actionRoute: `/legends/team/${teamFull.id}`,
      });
    }
    return mapLegendTeamJoinRequestRow(row);
  }

  if (!athlete || !athlete.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao incompleta.');
  }

  try {
    await athlete.fetch({ useMasterKey: true });
  } catch {
    /* ignore */
  }

  const refs = normalizeAthleteRefs(teamFull.get('athleteRefs'));
  if (userAlreadyOnLegendTeamRoster(refs, athlete.id)) {
    row.set('status', 'accepted');
    row.set('alreadyOnRoster', true);
    await row.save(null, { useMasterKey: true });
    throw new Parse.Error(
      Parse.Error.DUPLICATE_VALUE,
      'Este atleta ja consta no elenco do time lenda.'
    );
  }

  const label = String(athlete.get('apelido') || athlete.get('name') || 'Atleta').trim();
  const refsBeforePush = refs.slice();
  refs.push({ type: 'app_athlete', id: athlete.id, label });
  teamFull.set('athleteRefs', refs);
  await teamFull.save(null, { useMasterKey: true });
  if (typeof syncAthletePlayedLinksForLegendTeamChange === 'function') {
    await syncAthletePlayedLinksForLegendTeamChange(teamFull, refsBeforePush, refs);
  }

  row.set('status', 'accepted');
  await row.save(null, { useMasterKey: true });

  if (typeof createAppMessage === 'function') {
    await createAppMessage({
      recipientId: athlete.id,
      senderId: user.id,
      kind: 'legend_team_join_accepted',
      title: `Pedido aceito — ${teamName}`,
      body: `Voce foi incluido no elenco de "${teamName}".`,
      relatedClass: LEGEND_TEAM_JOIN_REQUEST_CLASS,
      relatedId: row.id,
      actionRoute: `/legends/team/${teamFull.id}`,
    });
  }

  return mapLegendTeamJoinRequestRow(row);
});

Parse.Cloud.define('listMyLegendTeamJoinRequests', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const asAthlete = new Parse.Query(LEGEND_TEAM_JOIN_REQUEST_CLASS).equalTo('athlete', user);
  const asRecipient = new Parse.Query(LEGEND_TEAM_JOIN_REQUEST_CLASS).containedIn('recipientUserIds', [
    user.id,
  ]);
  const query = Parse.Query.or(asAthlete, asRecipient);
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapLegendTeamJoinRequestRow);
});

Parse.Cloud.define('searchDirectoryTeamsForPicker', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const kind = String(request.params.kind || 'active').trim() === 'legend' ? 'legend' : 'active';
  const search = normalizeLegendSearch(request.params.search);
  const address =
    request.params.address && typeof request.params.address === 'object'
      ? request.params.address
      : {};
  const limit = Math.min(Math.max(Number(request.params.limit) || 50, 1), 100);

  if (kind === 'legend') {
    return searchLegendTeamsForPicker(search, address, limit);
  }
  return searchActiveAmateurTeamsForPicker(search, address, limit);
});

Parse.Cloud.define('listAmateurTeamsForLegend', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const address = request.params.address && typeof request.params.address === 'object'
    ? request.params.address
    : {};
  const limit = Math.min(Math.max(Number(request.params.limit) || 50, 1), 100);

  const rows = await searchActiveAmateurTeamsForPicker(search, address, limit);
  return rows.map(({ kind, subtitle, ...item }) => item);
});

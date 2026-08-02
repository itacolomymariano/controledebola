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

function mapLegendTeamRow(row) {
  const registeredBy = row.get('registeredByUser');
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
    registeredByUserId: registeredBy ? registeredBy.id : undefined,
    registeredByName: row.get('registeredByName') || undefined,
    registeredAt: row.get('registeredAt') ? row.get('registeredAt').toISOString() : undefined,
  };
}

function normalizeLegendSearch(value) {
  return String(value || '').trim().toLowerCase();
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

  const row = new Parse.Object('AmateurLegendTeam');
  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set('athleteRefs', Array.isArray(request.params.athleteRefs) ? request.params.athleteRefs : []);
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

  row.setACL(legendPublicAcl(user));
  await row.save(null, { useMasterKey: true });
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
      const haystack = `${row.name} ${row.apelido} ${(row.amateurTeams || []).join(' ')}`.toLowerCase();
      return haystack.includes(search);
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
      const haystack = `${row.name} ${row.apelido} ${row.description || ''}`.toLowerCase();
      return haystack.includes(search);
    });
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
  return mapLegendTeamRow(row);
});

Parse.Cloud.define('suggestAmateurFootballIdols', async (request) => {
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];
  const seen = new Set();

  function pushSuggestion(item) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return;
    if (search && !`${item.label} ${item.subtitle || ''}`.toLowerCase().includes(search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  const legendQuery = new Parse.Query('AmateurLegendAthlete');
  legendQuery.descending('createdAt');
  legendQuery.limit(limit);
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
  athleteQuery.limit(limit);
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
      const haystack = `${row.name} ${row.apelido} ${(row.proTeams || []).join(' ')}`.toLowerCase();
      return haystack.includes(search);
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
    if (search && !`${item.label} ${item.subtitle || ''}`.toLowerCase().includes(search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  const legendQuery = new Parse.Query('ProLegendAthlete');
  legendQuery.descending('createdAt');
  legendQuery.limit(limit);
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
  athleteQuery.limit(limit);
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
  return String(haystack || '')
    .toLowerCase()
    .includes(search);
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
    if (search && !`${label} ${row.get('name')}`.toLowerCase().includes(search)) continue;
    suggestions.push({
      id: row.id,
      label,
      subtitle: 'Lenda cadastrada',
      source: 'legend_athlete',
      imageUrl: row.get('imageUrl') || undefined,
    });
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.include('user');
  athleteQuery.limit(limit);
  for (const profile of await athleteQuery.find({ useMasterKey: true })) {
    const profileUser = profile.get('user');
    if (!profileUser?.id) continue;
    const fullUser = await new Parse.Query(Parse.User)
      .get(profileUser.id, { useMasterKey: true })
      .catch(() => null);
    if (!fullUser) continue;
    const label = fullUser.get('apelido') || fullUser.get('name') || 'Atleta';
    if (search && !label.toLowerCase().includes(search)) continue;
    suggestions.push({
      id: fullUser.id,
      label,
      subtitle: 'Atleta no app',
      source: 'app_athlete',
      imageUrl: fullUser.get('avatarUrl') || undefined,
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

Parse.Cloud.define('listAmateurTeamsForLegend', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const address = request.params.address && typeof request.params.address === 'object'
    ? request.params.address
    : {};
  const limit = Math.min(Math.max(Number(request.params.limit) || 50, 1), 100);

  const rows = await new Parse.Query('AmateurTeam').limit(200).find({ useMasterKey: true });
  const results = [];

  for (const row of rows) {
    const name = String(row.get('name') || '').trim();
    if (!name) continue;
    if (search && !name.toLowerCase().includes(search)) continue;

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
    results.push({
      id: row.id,
      name,
      imageUrl: teamImage && teamImage.url ? teamImage.url() : undefined,
      proximityScore: locationProximityScoreForLegend(address, presidentAddress),
    });
  }

  results.sort(
    (a, b) =>
      b.proximityScore - a.proximityScore || a.name.localeCompare(b.name, 'pt-BR')
  );
  return results.slice(0, limit).map(({ proximityScore, ...item }) => item);
});

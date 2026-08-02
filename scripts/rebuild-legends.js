const fs = require('fs');
const path = require('path');

const corruptedPath = path.join(__dirname, '..', 'cloud', 'source', '05-legends.js');
const outputPath = corruptedPath;

function extractProLegendBlock() {
  return `
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
      const haystack = \`\${row.name} \${row.apelido} \${(row.proTeams || []).join(' ')}\`.toLowerCase();
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
    const key = \`\${item.source}:\${item.id}\`;
    if (seen.has(key)) return;
    if (search && !\`\${item.label} \${item.subtitle || ''}\`.toLowerCase().includes(search)) return;
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
`.trim();
}

function extractTailBlock(lines) {
  const start = lines.findIndex((line) => line.startsWith('function locationProximityScoreForLegend'));
  const end = lines.findIndex((line, index) => index > start && line.startsWith('function assertWithinApontamentoWindow'));
  if (start < 0 || end < 0) return '';
  return lines.slice(start, end).join('\n').trimEnd();
}

function extractHeadBlock(lines) {
  const end = lines.findIndex((line) => line.includes('// Jobs para executar manualmente'));
  const sliceEnd = end >= 0 ? end : lines.findIndex((line) => line.startsWith('{"role"'));
  if (sliceEnd <= 0) return '';
  let head = lines.slice(0, sliceEnd).join('\n');
  head = head.replace(/\n\s*1\s+\}/g, '\n  }');
  return head.trimEnd();
}

function main() {
  const lines = fs.readFileSync(corruptedPath, 'utf8').split(/\r?\n/);
  const head = extractHeadBlock(lines);
  const tail = extractTailBlock(lines);
  const pro = extractProLegendBlock();

  if (!head || !tail) {
    console.error('Falha ao extrair blocos limpos de 05-legends.js');
    process.exit(1);
  }

  const insertAfter = "Parse.Cloud.define('suggestAmateurFootballIdols', async (request) => {";
  const insertIndex = head.indexOf(insertAfter);
  if (insertIndex < 0) {
    console.error('Marcador suggestAmateurFootballIdols nao encontrado.');
    process.exit(1);
  }

  const closeIndex = head.indexOf('});', head.indexOf('return suggestions.slice(0, limit);'));
  if (closeIndex < 0) {
    console.error('Fim de suggestAmateurFootballIdols nao encontrado.');
    process.exit(1);
  }

  const before = head.slice(0, closeIndex + 3);
  const after = head.slice(closeIndex + 3).trimStart();

  const content = [
    '/** Legendas amadoras e profissionais */',
    '',
    before,
    '',
    pro,
    '',
    after,
    '',
    tail,
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, `${content.trimEnd()}\n`, 'utf8');
  console.log(`05-legends.js reconstruido (${content.split(/\r?\n/).length} linhas)`);
}

main();

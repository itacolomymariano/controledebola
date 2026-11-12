/**
 * Vinculo atleta app ↔ times (lenda roster + AmateurTeamMembership + playedTeamLinks).
 * Ver docs/AGENT-ACTIVITY-CACHE.md — times em que atuou.
 */

const PLAYED_TEAM_MEMBERSHIP_CLASS = 'AmateurTeamMembership';

function getPlayedTeamOpsSecret() {
  return String(process.env.PROD_PURGE_SECRET || process.env.CPF_INTEGRITY_SECRET || '').trim();
}

function assertPlayedTeamOpsAuthorized(request) {
  if (request.master) return;
  const expected = getPlayedTeamOpsSecret();
  if (!expected) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Configure PROD_PURGE_SECRET para operacao de reconciliacao.'
    );
  }
  const provided = String(request.params.secret || '').trim();
  if (provided !== expected) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Secret invalido.');
  }
}

function normalizePlayedTeamLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const imageUrl = row && row.imageUrl ? String(row.imageUrl).trim() : '';
      return {
        kind: row && row.kind === 'active' ? 'active' : 'legend',
        teamId: String(row && row.teamId ? row.teamId : '').trim(),
        label: String(row && row.label ? row.label : '').trim(),
        source:
          row && (row.source === 'roster' || row.source === 'self' || row.source === 'manual')
            ? row.source
            : 'manual',
        imageUrl: imageUrl || undefined,
      };
    })
    .filter((row) => row.label.length > 0 || row.teamId.length > 0);
}

function parseFileUrl(file) {
  if (!file) return undefined;
  try {
    if (typeof file.url === 'function') return file.url() || undefined;
  } catch {
    return undefined;
  }
  if (file._url) return String(file._url);
  return undefined;
}

function legendTeamRowImageUrl(row) {
  if (!row) return undefined;
  const direct = String(row.get('imageUrl') || row.get('shieldImageUrl') || '').trim();
  if (direct) return direct;
  return (
    parseFileUrl(row.get('teamImage')) ||
    parseFileUrl(row.get('shieldImage')) ||
    parseFileUrl(row.get('image'))
  );
}

function activeTeamRowImageUrl(team) {
  if (!team) return undefined;
  const direct = String(team.get('shieldImageUrl') || team.get('teamImageUrl') || '').trim();
  if (direct) return direct;
  return parseFileUrl(team.get('shieldImage')) || parseFileUrl(team.get('teamImage'));
}

function teamLinkKey(link) {
  if (link.teamId) return `${link.kind}:${link.teamId}`;
  return `${link.kind}:${link.label.toLowerCase()}`;
}

function mergeTeamLinksUnique(links) {
  const map = new Map();
  for (const link of links) {
    const key = teamLinkKey(link);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, link);
      continue;
    }
    if (prev.source === 'manual' && link.source !== 'manual') {
      map.set(key, link);
    }
  }
  return Array.from(map.values());
}

async function getAthleteProfileForUserId(userId) {
  const user = Parse.User.createWithoutData(userId);
  return new Parse.Query('AthleteProfile').equalTo('user', user).first({ useMasterKey: true });
}

async function findLegendTeamLinksForAppAthlete(userId) {
  const query = new Parse.Query('AmateurLegendTeam');
  query.limit(500);
  const rows = await query.find({ useMasterKey: true });
  const links = [];
  for (const row of rows) {
    const refs = normalizeAthleteRefs(row.get('athleteRefs'));
    const onRoster = refs.some((ref) => ref.type === 'app_athlete' && ref.id === userId);
    if (!onRoster) continue;
    const label = String(row.get('apelido') || row.get('name') || '').trim();
    if (!label) continue;
    links.push({
      kind: 'legend',
      teamId: row.id,
      label,
      source: 'roster',
      imageUrl: legendTeamRowImageUrl(row),
    });
  }
  return links;
}

async function findActiveTeamLinksForAppAthlete(userId) {
  const user = Parse.User.createWithoutData(userId);
  const query = new Parse.Query(PLAYED_TEAM_MEMBERSHIP_CLASS);
  query.equalTo('user', user);
  query.equalTo('active', true);
  query.include('team');
  query.limit(200);
  const rows = await query.find({ useMasterKey: true });
  const links = [];
  for (const row of rows) {
    const team = row.get('team');
    if (!team || !team.id) continue;
    const label = String(team.get('name') || '').trim();
    if (!label) continue;
    links.push({
      kind: 'active',
      teamId: team.id,
      label,
      source: 'roster',
      imageUrl: activeTeamRowImageUrl(team),
    });
  }
  return links;
}

async function applyPlayedTeamLinksOnProfile(userId, links) {
  const profile = await getAthleteProfileForUserId(userId);
  if (!profile) return;
  const normalized = mergeTeamLinksUnique(normalizePlayedTeamLinks(links));
  const names = normalized.map((link) => link.label).filter(Boolean);
  profile.set('playedTeamLinks', normalized);
  profile.set('playedAmateurTeams', names);
  await profile.save(null, { useMasterKey: true });
}

async function patchPlayedTeamLinksOnProfile(userId, toAdd, toRemove) {
  const profile = await getAthleteProfileForUserId(userId);
  if (!profile) return;

  let links = normalizePlayedTeamLinks(profile.get('playedTeamLinks'));
  for (const rem of toRemove || []) {
    links = links.filter((link) => {
      if (rem.teamId && link.teamId === rem.teamId && link.kind === rem.kind) {
        if (!rem.source || rem.source === link.source) return false;
      }
      if (!rem.teamId && rem.label && link.label === rem.label && link.kind === rem.kind) {
        if (!rem.source || rem.source === link.source) return false;
      }
      return true;
    });
  }
  for (const add of toAdd || []) {
    if (!add.label && !add.teamId) continue;
    const key = teamLinkKey(add);
    if (!links.some((link) => teamLinkKey(link) === key)) {
      links.push(add);
    }
  }

  links = mergeTeamLinksUnique(links);
  const names = [...new Set(links.map((link) => link.label).filter(Boolean))];
  profile.set('playedTeamLinks', links);
  profile.set('playedAmateurTeams', names);
  await profile.save(null, { useMasterKey: true });
}

async function syncAthletePlayedLinksForLegendTeamChange(teamRow, previousRefs, nextRefs) {
  if (!teamRow || !teamRow.id) return;
  const prev = normalizeAthleteRefs(previousRefs);
  const next = normalizeAthleteRefs(nextRefs);
  const teamId = teamRow.id;
  const label = String(teamRow.get('apelido') || teamRow.get('name') || '').trim();

  const prevApp = new Set(prev.filter((ref) => ref.type === 'app_athlete').map((ref) => ref.id));
  const nextApp = new Set(next.filter((ref) => ref.type === 'app_athlete').map((ref) => ref.id));

  for (const userId of nextApp) {
    if (!prevApp.has(userId)) {
      await patchPlayedTeamLinksOnProfile(
        userId,
        [{ kind: 'legend', teamId, label, source: 'roster' }],
        []
      );
    }
  }
  for (const userId of prevApp) {
    if (!nextApp.has(userId)) {
      await patchPlayedTeamLinksOnProfile(
        userId,
        [],
        [{ kind: 'legend', teamId, label, source: 'roster' }]
      );
    }
  }
}

async function buildAthleteTeamLinksForPublicProfile(userId, athleteProfile, teamNamesSet) {
  const fromProfile = normalizePlayedTeamLinks(athleteProfile && athleteProfile.get('playedTeamLinks'));
  const fromLegend = await findLegendTeamLinksForAppAthlete(userId);
  const fromActive = await findActiveTeamLinksForAppAthlete(userId);

  const links = mergeTeamLinksUnique([...fromProfile, ...fromLegend, ...fromActive]);

  const playedManual = athleteProfile ? athleteProfile.get('playedAmateurTeams') : [];
  if (Array.isArray(playedManual)) {
    for (const entry of playedManual) {
      const label = String(entry || '').trim();
      if (!label) continue;
      if (!links.some((link) => link.label.toLowerCase() === label.toLowerCase())) {
        links.push({ kind: 'legend', teamId: '', label, source: 'manual' });
      }
    }
  }

  const legendIds = [
    ...new Set(links.filter((link) => link.kind === 'legend' && link.teamId && !link.imageUrl).map((link) => link.teamId)),
  ];
  const activeIds = [
    ...new Set(links.filter((link) => link.kind === 'active' && link.teamId && !link.imageUrl).map((link) => link.teamId)),
  ];
  const legendImageById = new Map();
  const activeImageById = new Map();

  if (legendIds.length) {
    const legendRows = await new Parse.Query('AmateurLegendTeam')
      .containedIn('objectId', legendIds)
      .limit(legendIds.length)
      .find({ useMasterKey: true });
    for (const row of legendRows) {
      const url = legendTeamRowImageUrl(row);
      if (url) legendImageById.set(row.id, url);
    }
  }
  if (activeIds.length) {
    const activeRows = await new Parse.Query('AmateurTeam')
      .containedIn('objectId', activeIds)
      .limit(activeIds.length)
      .find({ useMasterKey: true });
    for (const row of activeRows) {
      const url = activeTeamRowImageUrl(row);
      if (url) activeImageById.set(row.id, url);
    }
  }

  for (const link of links) {
    if (link.label) teamNamesSet.add(link.label);
    if (!link.imageUrl && link.teamId) {
      if (link.kind === 'legend') link.imageUrl = legendImageById.get(link.teamId);
      if (link.kind === 'active') link.imageUrl = activeImageById.get(link.teamId);
    }
  }

  return links.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

Parse.Cloud.define('removeAthletePlayedTeamLink', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const targetUserId = String(request.params.userId || user.id).trim();
  if (targetUserId !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'So e possivel desvincular o proprio perfil.');
  }

  const kind = request.params.kind === 'active' ? 'active' : 'legend';
  const teamId = String(request.params.teamId || '').trim();
  const label = String(request.params.label || '').trim();

  if (!teamId && !label) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }

  if (kind === 'legend' && teamId) {
    const teamRow = await new Parse.Query('AmateurLegendTeam')
      .get(teamId, { useMasterKey: true })
      .catch(() => null);
    if (teamRow) {
      const refs = normalizeAthleteRefs(teamRow.get('athleteRefs'));
      const filtered = refs.filter((ref) => !(ref.type === 'app_athlete' && ref.id === targetUserId));
      if (filtered.length !== refs.length) {
        teamRow.set('athleteRefs', filtered);
        await teamRow.save(null, { useMasterKey: true });
      }
    }
  }

  await patchPlayedTeamLinksOnProfile(
    targetUserId,
    [],
    [{ kind, teamId, label, source: undefined }]
  );

  return { ok: true };
});

Parse.Cloud.define('reconcilePlayedTeamLinksFromRosters', async (request) => {
  assertPlayedTeamOpsAuthorized(request);

  const query = new Parse.Query('AmateurLegendTeam');
  query.limit(1000);
  const teams = await query.find({ useMasterKey: true });
  let teamsProcessed = 0;
  let athletesSynced = 0;

  for (const team of teams) {
    const refs = normalizeAthleteRefs(team.get('athleteRefs'));
    const label = String(team.get('apelido') || team.get('name') || '').trim();
    for (const ref of refs) {
      if (ref.type !== 'app_athlete' || !ref.id) continue;
      await patchPlayedTeamLinksOnProfile(
        ref.id,
        [{ kind: 'legend', teamId: team.id, label, source: 'roster' }],
        []
      );
      athletesSynced += 1;
    }
    teamsProcessed += 1;
  }

  return { ok: true, teamsProcessed, athletesSynced };
});

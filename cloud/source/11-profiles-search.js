/** Perfis — busca de atletas, funcoes e escudos de times */

// Busca de atletas e perfis publicos
function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function calcAgeFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function readUserFavoriteProTeam(user, ...legacyValues) {
  const fromUser = String(user?.get?.('favoriteProTeam') || '').trim();
  if (fromUser) return fromUser;
  for (const legacy of legacyValues) {
    const value = String(legacy || '').trim();
    if (value) return value;
  }
  return undefined;
}

function readUserFavoriteAmateurTeam(user, ...legacyValues) {
  const fromUser = String(user?.get?.('favoriteAmateurTeam') || '').trim();
  if (fromUser) return fromUser;
  for (const legacy of legacyValues) {
    const value = String(legacy || '').trim();
    if (value) return value;
  }
  return undefined;
}

function readUserProFootballIdol(user) {
  const value = String(user?.get?.('proFootballIdol') || '').trim();
  return value || undefined;
}

function readUserAmateurFootballIdol(user) {
  const value = String(user?.get?.('amateurFootballIdol') || '').trim();
  return value || undefined;
}

function computePerformanceScore(perf) {
  const goals = Number(perf.get('goals') ?? 0);
  const assists = Number(perf.get('assists') ?? 0);
  const saves = Number(perf.get('saves') ?? 0);
  const yellowCards = Number(perf.get('yellowCards') ?? 0);
  const redCards = Number(perf.get('redCards') ?? 0);
  const points = Number(perf.get('points') ?? 0);
  return points + goals * 3 + assists * 2 + saves * 2 - yellowCards - redCards * 3;
}

async function getTopAthleteUserIdForPelada(peladaId) {
  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const statsPriority = await loadPeladaStatsConflictSource(peladaId);

  const perfQuery = new Parse.Query('EventPerformance');
  perfQuery.equalTo('pelada', pelada);
  perfQuery.limit(1000);
  const performances = await perfQuery.find({ useMasterKey: true });

  const voteQuery = new Parse.Query('MuralVote');
  voteQuery.equalTo('scope', 'pelada');
  voteQuery.equalTo('scopeId', peladaId);
  voteQuery.equalTo('targetRole', 'athlete');
  voteQuery.limit(1000);
  const votes = await voteQuery.find({ useMasterKey: true });

  const perfScores = new Map();
  for (const perf of performances) {
    if (perf.get('role') !== 'athlete') continue;
    const userId = getPerformanceParticipantId(perf);
    if (!userId) continue;
    const score = computeEffectivePerformanceScore(perf, statsPriority);
    perfScores.set(userId, (perfScores.get(userId) || 0) + score);
  }

  const voteAgg = new Map();
  for (const vote of votes) {
    const targetUser = vote.get('targetUser');
    const userId = targetUser && targetUser.id ? targetUser.id : null;
    if (!userId) continue;
    const score = Number(vote.get('score') ?? 0);
    const current = voteAgg.get(userId) || { total: 0, count: 0 };
    current.total += score;
    current.count += 1;
    voteAgg.set(userId, current);
  }

  const userIds = new Set([...perfScores.keys(), ...voteAgg.keys()]);
  let bestUserId = null;
  let bestScore = -1;

  for (const userId of userIds) {
    const performanceScore = perfScores.get(userId) || 0;
    const voteData = voteAgg.get(userId);
    const averageScore = voteData && voteData.count ? voteData.total / voteData.count : 0;
    const combinedScore = performanceScore + averageScore * 10;
    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestUserId = userId;
    }
  }

  return bestScore > 0 ? bestUserId : null;
}

Parse.Cloud.define('searchAthletes', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const search = normalizeSearchText(request.params.query);

  const profiles = await new Parse.Query('AthleteProfile')
    .include('user')
    .limit(1000)
    .find({ useMasterKey: true });

  const results = [];
  const seen = new Set();

  for (const profile of profiles) {
    let user = profile.get('user');
    if (!user || !user.id) continue;

    if (!user.get('apelido') && !user.get('name')) {
      try {
        user = await new Parse.Query(Parse.User).get(user.id, { useMasterKey: true });
      } catch (error) {
        // mantem referencia parcial
      }
    }

    const userId = user.id;
    if (seen.has(userId)) continue;

    const apelido =
      profile.get('userApelido') || user.get('apelido') || '';
    const fullName = user.get('name') || '';
    const username = user.getUsername() || '';
    const displayName =
      profile.get('userName') ||
      apelido ||
      fullName ||
      username ||
      'Atleta';
    const position = profile.get('primaryPosition') || '';
    const address = user.get('address') || {};
    const city = profile.get('userCity') || address.city || '';
    const state = profile.get('userState') || address.state || '';

    if (search.length > 0) {
      const haystack = normalizeSearchText(
        `${apelido} ${fullName} ${displayName} ${username} ${position} ${city} ${state}`
      );
      if (!haystack.includes(search)) continue;
    }

    seen.add(userId);
    results.push({
      userId,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      primaryPosition: position,
      city: city || undefined,
      state: state || undefined,
      avatarUrl:
        profile.get('userAvatarUrl') ||
        user.get('avatarUrl') ||
        undefined,
      peladaRate: profile.get('peladaRate') ?? undefined,
      teamMatchRate: profile.get('teamMatchRate') ?? undefined,
    });
  }

  if (search.length > 0) {
    const rawQuery = String(request.params.query || '').trim();
    const apelidoUserQuery = new Parse.Query(Parse.User);
    apelidoUserQuery.matches('apelido', rawQuery, 'i');
    const nameUserQuery = new Parse.Query(Parse.User);
    nameUserQuery.matches('name', rawQuery, 'i');
    const usernameUserQuery = new Parse.Query(Parse.User);
    usernameUserQuery.matches('username', rawQuery, 'i');

    const matchingUsers = await Parse.Query.or(
      apelidoUserQuery,
      nameUserQuery,
      usernameUserQuery
    )
      .limit(100)
      .find({ useMasterKey: true });

    for (const user of matchingUsers) {
      if (!user.id || seen.has(user.id)) continue;
      const athleteProfile = await new Parse.Query('AthleteProfile')
        .equalTo('user', user)
        .first({ useMasterKey: true });
      if (!athleteProfile) continue;

      const apelido = user.get('apelido') || '';
      const fullName = user.get('name') || '';
      const displayName = apelido || fullName || user.getUsername() || 'Atleta';
      const address = user.get('address') || {};

      seen.add(user.id);
      results.push({
        userId: user.id,
        displayName,
        apelido: apelido || undefined,
        fullName: fullName || undefined,
        primaryPosition: athleteProfile.get('primaryPosition') || '',
        city: athleteProfile.get('userCity') || address.city || undefined,
        state: athleteProfile.get('userState') || address.state || undefined,
        avatarUrl:
          athleteProfile.get('userAvatarUrl') ||
          user.get('avatarUrl') ||
          undefined,
      });
    }
  }

  const ranked = results.sort((a, b) => {
    if (search.length > 0) {
      const scoreDiff = athleteRelevanceScore(b, search) - athleteRelevanceScore(a, search);
      if (scoreDiff !== 0) return scoreDiff;
    }
    return a.displayName.localeCompare(b.displayName, 'pt-BR');
  });

  return ranked.slice(0, 100);
});

function mapAthleteProfileToHiringCandidate(profile, user) {
  const apelido = profile.get('userApelido') || user.get('apelido') || '';
  const fullName = user.get('name') || '';
  const username = user.getUsername() || '';
  const displayName =
    profile.get('userName') || apelido || fullName || username || 'Atleta';
  const address = user.get('address') || {};

  return {
    userId: user.id,
    userName: fullName || displayName,
    apelido: apelido || displayName,
    avatarUrl: profile.get('userAvatarUrl') || user.get('avatarUrl') || undefined,
    city: profile.get('userCity') || address.city || undefined,
    state: profile.get('userState') || address.state || undefined,
    peladaRate: profile.get('peladaRate') ?? undefined,
    matchRate: profile.get('teamMatchRate') ?? undefined,
  };
}

function matchesAthleteHiringSearch(parts, search) {
  if (!search) return true;
  const haystack = normalizeSearchText(parts.filter(Boolean).join(' '));
  return haystack.includes(search);
}

Parse.Cloud.define('listAthleteHiringCandidates', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const search = normalizeSearchText(request.params.query || '');
  const byUserId = new Map();

  const profiles = await new Parse.Query('AthleteProfile')
    .include('user')
    .limit(1000)
    .find({ useMasterKey: true });

  for (const profile of profiles) {
    let user = profile.get('user');
    if (!user || !user.id) continue;

    if (!user.get('apelido') && !user.get('name')) {
      try {
        user = await new Parse.Query(Parse.User).get(user.id, { useMasterKey: true });
      } catch {
        // mantem referencia parcial
      }
    }

    const candidate = mapAthleteProfileToHiringCandidate(profile, user);
    if (!matchesAthleteHiringSearch([candidate.apelido, candidate.userName, candidate.city, candidate.state], search)) {
      continue;
    }
    byUserId.set(candidate.userId, candidate);
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .descending('createdAt')
    .limit(2000)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId || byUserId.has(resolved.userId)) continue;

    const user = registration.get('user');
    const athlete = registration.get('athlete');
    const apelido =
      registration.get('apelido') ||
      registration.get('userApelido') ||
      (user && user.get ? user.get('apelido') : '') ||
      '';
    const userName =
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      apelido ||
      (user && user.get ? user.get('name') : '') ||
      'Atleta';
    const address = user && user.get ? user.get('address') || {} : {};

    if (
      !matchesAthleteHiringSearch(
        [
          apelido,
          userName,
          registration.get('userCity') || address.city,
          registration.get('userState') || address.state,
        ],
        search
      )
    ) {
      continue;
    }

    byUserId.set(resolved.userId, {
      userId: resolved.userId,
      userName,
      apelido: apelido || userName,
      avatarUrl: registration.get('avatarUrl') || undefined,
      city: registration.get('userCity') || address.city || undefined,
      state: registration.get('userState') || address.state || undefined,
      peladaRate: athlete && athlete.get ? athlete.get('peladaRate') ?? undefined : undefined,
      matchRate: athlete && athlete.get ? athlete.get('teamMatchRate') ?? undefined : undefined,
    });
  }

  if (search.length > 0) {
    const rawQuery = String(request.params.query || '').trim();
    const apelidoUserQuery = new Parse.Query(Parse.User);
    apelidoUserQuery.matches('apelido', rawQuery, 'i');
    const nameUserQuery = new Parse.Query(Parse.User);
    nameUserQuery.matches('name', rawQuery, 'i');
    const usernameUserQuery = new Parse.Query(Parse.User);
    usernameUserQuery.matches('username', rawQuery, 'i');

    const matchingUsers = await Parse.Query.or(
      apelidoUserQuery,
      nameUserQuery,
      usernameUserQuery
    )
      .limit(100)
      .find({ useMasterKey: true });

    for (const user of matchingUsers) {
      if (!user.id || byUserId.has(user.id)) continue;
      const athleteProfile = await new Parse.Query('AthleteProfile')
        .equalTo('user', user)
        .first({ useMasterKey: true });
      if (!athleteProfile) continue;
      byUserId.set(user.id, mapAthleteProfileToHiringCandidate(athleteProfile, user));
    }
  }

  return Array.from(byUserId.values()).sort((a, b) =>
    (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
  );
});

function athleteRelevanceScore(entry, search) {
  const fields = [entry.displayName, entry.apelido, entry.fullName, entry.primaryPosition]
    .filter(Boolean)
    .map((value) => normalizeSearchText(String(value)));

  let best = 0;
  for (const field of fields) {
    if (field === search) best = Math.max(best, 100);
    else if (field.startsWith(search)) best = Math.max(best, 80);
    else if (field.includes(search)) best = Math.max(best, 50);
  }
  return best;
}

Parse.Cloud.define('getAthletePublicProfile', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const userId = String(request.params.userId || '').trim();
  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId obrigatorio.');
  }

  let user;
  try {
    user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
  } catch (error) {
    if (error && error.code === Parse.Error.OBJECT_NOT_FOUND) {
      return null;
    }
    throw error;
  }
  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.equalTo('user', user);
  const athleteProfile = await athleteQuery.first({ useMasterKey: true });

  if (!athleteProfile) {
    return null;
  }

  const apelido = user.get('apelido') || '';
  const fullName = user.get('name') || '';
  const displayName = apelido || fullName || user.getUsername() || 'Atleta';
  const address = user.get('address') || {};
  const birthDate = user.get('birthDate');

  const teamQuery = new Parse.Query('AmateurTeam');
  teamQuery.equalTo('president', user);
  const amateurTeams = await teamQuery.find({ useMasterKey: true });

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.equalTo('user', user);
  regQuery.equalTo('role', 'athlete');
  regQuery.include('event');
  regQuery.include('event.pelada');
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });

  const peladaNames = new Set();
  const teamNames = new Set();
  const peladaIds = new Set();

  for (const team of amateurTeams) {
    const name = team.get('name');
    if (name) teamNames.add(name);
  }

  for (const registration of registrations) {
    const event = registration.get('event');
    if (!event) continue;
    const pelada = event.get('pelada');
    if (pelada && pelada.get('name')) {
      peladaNames.add(pelada.get('name'));
      if (pelada.id) peladaIds.add(pelada.id);
    }
    const homeTeamName = event.get('homeTeamName');
    const awayTeamName = event.get('awayTeamName');
    if (homeTeamName) teamNames.add(homeTeamName);
    if (awayTeamName) teamNames.add(awayTeamName);
  }

  const membershipQuery = new Parse.Query('PeladaMembership');
  membershipQuery.equalTo('user', user);
  membershipQuery.equalTo('status', 'active');
  membershipQuery.include('pelada');
  membershipQuery.limit(500);
  const memberships = await membershipQuery.find({ useMasterKey: true });
  for (const membership of memberships) {
    const pelada = membership.get('pelada');
    if (pelada && pelada.get('name')) {
      peladaNames.add(pelada.get('name'));
      if (pelada.id) peladaIds.add(pelada.id);
    }
  }

  const perfQuery = new Parse.Query('EventPerformance');
  perfQuery.equalTo('user', user);
  perfQuery.limit(2000);
  const performances = await perfQuery.find({ useMasterKey: true });

  let goals = 0;
  let yellowCards = 0;
  let redCards = 0;
  for (const perf of performances) {
    goals += Number(perf.get('goals') ?? 0);
    yellowCards += Number(perf.get('yellowCards') ?? 0);
    redCards += Number(perf.get('redCards') ?? 0);
  }

  const craquePeladas = [];
  for (const peladaId of peladaIds) {
    const topUserId = await getTopAthleteUserIdForPelada(peladaId);
    if (topUserId === userId) {
      const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
      const name = pelada.get('name');
      if (name) craquePeladas.push(name);
    }
  }

  const favoriteAmateurTeam = readUserFavoriteAmateurTeam(
    user,
    amateurTeams[0] ? amateurTeams[0].get('name') : undefined
  );

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    avatarUrl:
      athleteProfile.get('userAvatarUrl') ||
      user.get('avatarUrl') ||
      undefined,
    state: address.state || undefined,
    city: address.city || undefined,
    neighborhood: address.neighborhood || undefined,
    age: calcAgeFromBirthDate(birthDate),
    peladas: Array.from(peladaNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    teams: Array.from(teamNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    favoriteProTeam: readUserFavoriteProTeam(user, athleteProfile.get('favoriteProTeam')),
    favoriteAmateurTeam,
    goals,
    yellowCards,
    redCards,
    proFootballIdol: readUserProFootballIdol(user),
    amateurFootballIdol: readUserAmateurFootballIdol(user),
    craquePeladas: craquePeladas.sort((a, b) => a.localeCompare(b, 'pt-BR')),
    phone: user.get('showPhoneInProfile') ? user.get('phone') || undefined : undefined,
    email: user.get('showEmailInProfile') ? user.get('email') || undefined : undefined,
    phoneVisible: !!user.get('showPhoneInProfile'),
    emailVisible: !!user.get('showEmailInProfile'),
    peladaRate: athleteProfile.get('peladaRate') ?? undefined,
    teamMatchRate: athleteProfile.get('teamMatchRate') ?? undefined,
    primaryPosition: athleteProfile.get('primaryPosition') || '',
  };
});

const PROFILE_ROLE_LABELS = {
  referee: 'Juiz',
  scout: 'Scout / Mesario',
  journalist: 'Jornalista',
  cameraman: 'Cinegrafista',
  narrator: 'Narrador',
  coach: 'Treinador',
  physical_trainer: 'Preparador Fisico',
  masseur: 'Massagista',
  kitman: 'Ropeiro',
  gandula: 'Gandula',
  gatekeeper: 'Porteiro',
  fan: 'Torcedor',
};

const SEARCHABLE_PROFILE_ROLES = [
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
  'gatekeeper',
  'fan',
];

const PROFESSIONAL_PROFILE_ROLES = SEARCHABLE_PROFILE_ROLES.filter((role) => role !== 'fan');

const ROLE_HISTORY_MODE = {
  referee: 'pelada_match',
  scout: 'pelada_match',
  journalist: 'pelada_match',
  cameraman: 'pelada_match',
  narrator: 'pelada_match',
  coach: 'teams_only',
  physical_trainer: 'teams_only',
  masseur: 'pelada_teams',
  kitman: 'pelada_teams',
  gandula: 'pelada_match',
  gatekeeper: 'pelada_match',
};

function isProfessionalProfileRole(role) {
  return PROFESSIONAL_PROFILE_ROLES.includes(role);
}

function profileRoleToMuralRole(role) {
  if (role === 'fan') return null;
  return role;
}

function pickRicherText(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left) return right || undefined;
  if (!right) return left;
  return left.length >= right.length ? left : right;
}

function mergeProfileSearchEntries(primary, secondary) {
  return {
    userId: primary.userId,
    role: primary.role,
    displayName:
      pickRicherText(primary.displayName, secondary.displayName) ||
      primary.displayName ||
      secondary.displayName ||
      PROFILE_ROLE_LABELS[primary.role],
    apelido: pickRicherText(primary.apelido, secondary.apelido),
    fullName: pickRicherText(primary.fullName, secondary.fullName),
    subtitle: pickRicherText(primary.subtitle, secondary.subtitle),
    city: primary.city || secondary.city,
    state: primary.state || secondary.state,
    avatarUrl: primary.avatarUrl || secondary.avatarUrl,
  };
}

function toProfileSearchResultFromRoleProfile(profile, role) {
  const user = profile.get('user');
  const userId = profile.get('userId') || (user && user.id ? user.id : '');
  const apelido = profile.get('userApelido') || (user && user.get ? user.get('apelido') : '') || '';
  const fullName =
    profile.get('userFullName') ||
    (user && user.get ? user.get('name') : '') ||
    '';
  const displayName =
    profile.get('userName') ||
    apelido ||
    fullName ||
    (user && user.getUsername ? user.getUsername() : '') ||
    PROFILE_ROLE_LABELS[role];
  const address = user && user.get ? user.get('address') || {} : {};

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    role,
    subtitle: PROFILE_ROLE_LABELS[role],
    city: profile.get('userCity') || address.city || undefined,
    state: profile.get('userState') || address.state || undefined,
    avatarUrl: profile.get('userAvatarUrl') || (user && user.get ? user.get('avatarUrl') : undefined) || undefined,
  };
}

function toProfileSearchResultFromRegistration(registration, role) {
  const user = registration.get('user');
  const userId =
    registration.get('participantUserId') ||
    (user && user.id ? user.id : '');
  const apelido =
    registration.get('apelido') ||
    registration.get('userApelido') ||
    (user && user.get ? user.get('apelido') : '') ||
    '';
  const fullName =
    registration.get('userFullName') ||
    (user && user.get ? user.get('name') : '') ||
    '';
  const displayName =
    registration.get('userDisplayName') ||
    apelido ||
    fullName ||
    (user && user.getUsername ? user.getUsername() : '') ||
    PROFILE_ROLE_LABELS[role];

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    role,
    subtitle: PROFILE_ROLE_LABELS[role],
    avatarUrl:
      registration.get('avatarUrl') ||
      (user && user.get ? user.get('avatarUrl') : undefined) ||
      undefined,
  };
}

function profileRelevanceScore(entry, search) {
  const fields = [entry.displayName, entry.apelido, entry.fullName, entry.subtitle]
    .filter(Boolean)
    .map((value) => normalizeSearchText(String(value)));

  let best = 0;
  for (const field of fields) {
    if (field === search) best = Math.max(best, 100);
    else if (field.startsWith(search)) best = Math.max(best, 80);
    else if (field.includes(search)) best = Math.max(best, 50);
  }
  return best;
}

const ROLE_SEARCH_ALIASES = {
  physical_trainer: ['prep', 'preparador', 'pf', 'fisico', 'physical_trainer', 'physical trainer'],
  masseur: ['mass', 'massag', 'massagista', 'masseur'],
  kitman: ['roup', 'rope', 'ropeiro', 'roupeiro', 'kit', 'kitman'],
  coach: ['trein', 'treinador', 'coach', 'tec', 'tecnico'],
  referee: ['juiz', 'arb', 'arbitro', 'referee'],
  scout: ['scout', 'mesario', 'mesa'],
  journalist: ['jornal', 'jornalista', 'imprensa'],
  cameraman: ['cine', 'cinegrafista', 'camera'],
  narrator: ['narr', 'narrador', 'radio'],
  gandula: ['gandula', 'ganda'],
  gatekeeper: ['port', 'porteiro', 'gate'],
  fan: ['torc', 'torcedor', 'fan'],
};

function searchMatchesRoleKeyword(search, role) {
  if (!search) return false;
  const label = normalizeSearchText(PROFILE_ROLE_LABELS[role] || '');
  if (label && (label.includes(search) || search.includes(label))) return true;
  for (const token of label.split(/\s+/)) {
    if (token.length >= 3 && (token.startsWith(search) || token.includes(search))) return true;
  }
  for (const alias of ROLE_SEARCH_ALIASES[role] || []) {
    const normalizedAlias = normalizeSearchText(alias);
    if (!normalizedAlias) continue;
    if (
      normalizedAlias === search ||
      normalizedAlias.startsWith(search) ||
      search.startsWith(normalizedAlias) ||
      normalizedAlias.includes(search)
    ) {
      return true;
    }
  }
  return false;
}

function matchesProfileSearchQuery(entry, search) {
  if (!search) return true;
  if (searchMatchesRoleKeyword(search, entry.role)) return true;
  const haystack = normalizeSearchText(
    `${entry.displayName || ''} ${entry.apelido || ''} ${entry.fullName || ''} ${entry.subtitle || ''} ${entry.city || ''} ${entry.state || ''} ${PROFILE_ROLE_LABELS[entry.role] || ''}`
  );
  if (haystack.includes(search)) return true;
  const tokens = search.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length <= 1) return false;
  return tokens.every((token) => haystack.includes(token));
}

function applyRoleProfileHiringAcl(profile) {
  const user = profile.get('user');
  if (user && user.id && !profile.get('userId')) {
    profile.set('userId', user.id);
  }
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  if (user && user.id) {
    acl.setWriteAccess(user, true);
  }
  profile.setACL(acl);
}

Parse.Cloud.beforeSave('RoleProfile', (request) => {
  const profile = request.object;
  const user = profile.get('user') || request.user;
  if (user) {
    if (!profile.get('user')) profile.set('user', user);
    if (user.id) profile.set('userId', user.id);
  }
  applyRoleProfileHiringAcl(profile);
});

function toProfileSearchResultFromUser(user, role) {
  const apelido = (user.get('apelido') || '').trim();
  const fullName = (user.get('name') || '').trim();
  const address = user.get('address') || {};
  return {
    userId: user.id,
    displayName: apelido || fullName || user.getUsername() || PROFILE_ROLE_LABELS[role],
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    role,
    subtitle: PROFILE_ROLE_LABELS[role],
    city: address.city || undefined,
    state: address.state || undefined,
    avatarUrl: user.get('avatarUrl') || undefined,
  };
}

async function appendUsersByPrimaryRole(byUserId, role, search) {
  const users = await new Parse.Query(Parse.User)
    .equalTo('primaryRole', role)
    .limit(500)
    .find({ useMasterKey: true });
  for (const user of users) {
    if (!user.id) continue;
    const entry = toProfileSearchResultFromUser(user, role);
    if (!matchesProfileSearchQuery(entry, search)) continue;
    const existing = byUserId.get(entry.userId);
    byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
  }
}

function roleProfileHasDisplayName(profile) {
  const user = profile.get('user');
  return (
    !!(profile.get('userApelido') || profile.get('userName') || profile.get('userFullName')) ||
    !!(user && user.get && (user.get('apelido') || user.get('name') || user.getUsername()))
  );
}

async function hydrateRoleProfilesMissingUser(profiles) {
  const missingUserIds = [];
  for (const profile of profiles) {
    const user = profile.get('user');
    const userId = profile.get('userId') || (user && user.id ? user.id : '');
    if (userId && !roleProfileHasDisplayName(profile)) {
      missingUserIds.push(userId);
    }
  }
  if (!missingUserIds.length) return;

  const uniqueIds = Array.from(new Set(missingUserIds));
  const users = await new Parse.Query(Parse.User)
    .containedIn('objectId', uniqueIds)
    .limit(Math.min(uniqueIds.length, 500))
    .find({ useMasterKey: true });
  const byId = new Map(users.map((user) => [user.id, user]));
  for (const profile of profiles) {
    if (roleProfileHasDisplayName(profile)) continue;
    const user = profile.get('user');
    const userId = profile.get('userId') || (user && user.id ? user.id : '');
    if (!userId || !byId.has(userId)) continue;
    profile.set('user', byId.get(userId));
  }
}

function roleProfileToPayload(row, role) {
  if (!row) return undefined;
  return {
    objectId: row.id,
    role,
    peladaRate: row.get('peladaRate') ?? undefined,
    matchRate: row.get('matchRate') ?? undefined,
    athleteRate: row.get('athleteRate') ?? undefined,
    peladaLiveRate: row.get('peladaLiveRate') ?? undefined,
    matchLiveRate: row.get('matchLiveRate') ?? undefined,
    peladaHighlightEditRate: row.get('peladaHighlightEditRate') ?? undefined,
    matchHighlightEditRate: row.get('matchHighlightEditRate') ?? undefined,
    peladaGoalNarrationEditRate: row.get('peladaGoalNarrationEditRate') ?? undefined,
    matchGoalNarrationEditRate: row.get('matchGoalNarrationEditRate') ?? undefined,
    teamTrainingRate: row.get('teamTrainingRate') ?? undefined,
    teamRate: row.get('teamRate') ?? undefined,
    hasOwnEquipment: row.get('hasOwnEquipment') ?? undefined,
    isFederatedReferee: row.get('isFederatedReferee') ?? undefined,
    federationName: row.get('federationName') || undefined,
    federationRegistrationNumber: row.get('federationRegistrationNumber') || undefined,
    equipmentDescription: row.get('equipmentDescription') || undefined,
    pixKey1: row.get('pixKey1') || undefined,
    pixKey2: row.get('pixKey2') || undefined,
    pixKey3: row.get('pixKey3') || undefined,
  };
}

async function loadProfileRegistrationsForUser(userId, role) {
  const userPtr = Parse.User.createWithoutData(userId);

  const byParticipantId = new Parse.Query('EventRegistration');
  byParticipantId.equalTo('participantUserId', userId);
  byParticipantId.equalTo('role', role);

  const byUser = new Parse.Query('EventRegistration');
  byUser.equalTo('user', userPtr);
  byUser.equalTo('role', role);

  const query = Parse.Query.or(byParticipantId, byUser);
  query.include('event');
  query.include('event.pelada');
  query.limit(2000);
  return query.find({ useMasterKey: true });
}

async function getMuralCombinedScore(userId, targetRole, scope, scopeId, cache) {
  if (!scopeId) return 0;

  const cacheKey = `${scope}:${scopeId}:${targetRole}:${userId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  let performanceScore = 0;
  const perfQuery = new Parse.Query('EventPerformance');
  if (scope === 'pelada') {
    perfQuery.equalTo('pelada', Parse.Object.extend('Pelada').createWithoutData(scopeId));
  } else {
    perfQuery.equalTo('event', Parse.Object.extend('Event').createWithoutData(scopeId));
  }
  perfQuery.limit(1000);
  const performances = await perfQuery.find({ useMasterKey: true });

  for (const perf of performances) {
    if (perf.get('role') !== targetRole) continue;
    const user = perf.get('user');
    if (!user || user.id !== userId) continue;
    performanceScore += computePerformanceScore(perf);
  }

  const voteQuery = new Parse.Query('MuralVote');
  voteQuery.equalTo('scope', scope);
  voteQuery.equalTo('scopeId', scopeId);
  voteQuery.equalTo('targetRole', targetRole);
  voteQuery.limit(1000);
  const votes = await voteQuery.find({ useMasterKey: true });

  let total = 0;
  let count = 0;
  for (const vote of votes) {
    const targetUser = vote.get('targetUser');
    if (!targetUser || targetUser.id !== userId) continue;
    total += Number(vote.get('score') ?? 0);
    count += 1;
  }

  const averageScore = count > 0 ? total / count : 0;
  const combinedScore = performanceScore + averageScore * 10;
  cache.set(cacheKey, combinedScore);
  return combinedScore;
}

function upsertHistoryRecord(map, id, name, score) {
  const existing = map.get(id);
  if (!existing) {
    map.set(id, { id, name, score });
    return;
  }
  existing.score = Math.max(existing.score, score);
}

async function buildRoleParticipationHistory(userId, role) {
  const mode = ROLE_HISTORY_MODE[role] || 'none';
  if (role === 'fan') {
    const registrations = await loadProfileRegistrationsForUser(userId, 'fan');
    const peladas = new Map();
    for (const registration of registrations) {
      const event = registration.get('event');
      if (!event) continue;
      const pelada = event.get('pelada');
      const peladaId = pelada && pelada.id ? pelada.id : null;
      const name = (pelada && pelada.get('name')) || event.get('name');
      if (!peladaId || !name) continue;
      if (!peladas.has(peladaId)) {
        peladas.set(peladaId, { id: peladaId, name, score: 0 });
      }
    }
    return {
      peladas: Array.from(peladas.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      matches: [],
      teams: [],
    };
  }

  if (mode === 'none') {
    return { peladas: [], matches: [], teams: [] };
  }

  const muralRole = profileRoleToMuralRole(role);
  const registrations = await loadProfileRegistrationsForUser(userId, role);
  const peladaScores = new Map();
  const matchScores = new Map();
  const teamScores = new Map();
  const muralCache = new Map();

  for (const registration of registrations) {
    const event = registration.get('event');
    if (!event || !event.id) continue;

    const eventType = event.get('type');
    const pelada = event.get('pelada');
    const peladaId = pelada && pelada.id ? pelada.id : null;
    const peladaName = (pelada && pelada.get('name')) || event.get('name');

    const score = muralRole
      ? await getMuralCombinedScore(
          userId,
          muralRole,
          eventType === 'team_match' ? 'event' : 'pelada',
          eventType === 'team_match' ? event.id : peladaId,
          muralCache
        )
      : 0;

    if (eventType === 'team_match') {
      const home = String(event.get('homeTeamName') || '').trim();
      const away = String(event.get('awayTeamName') || '').trim();
      const matchLabel = home && away ? `${home} x ${away}` : event.get('name') || 'Partida';
      upsertHistoryRecord(matchScores, event.id, matchLabel, score);

      if (mode === 'teams_only' || mode === 'pelada_teams') {
        if (home) upsertHistoryRecord(teamScores, `team:${home}`, home, score);
        if (away) upsertHistoryRecord(teamScores, `team:${away}`, away, score);
      }
    } else if (peladaId && peladaName && (mode === 'pelada_match' || mode === 'pelada_teams')) {
      upsertHistoryRecord(peladaScores, peladaId, peladaName, score);
    }
  }

  const sortByName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
  return {
    peladas: Array.from(peladaScores.values()).sort(sortByName),
    matches: Array.from(matchScores.values()).sort(sortByName),
    teams: Array.from(teamScores.values()).sort(sortByName),
  };
}

Parse.Cloud.define('searchProfiles', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const role = String(request.params.role || '').trim();
  if (!SEARCHABLE_PROFILE_ROLES.includes(role)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Perfil invalido.');
  }

  const search = normalizeSearchText(request.params.query);
  const byUserId = new Map();

  if (isProfessionalProfileRole(role)) {
    const profiles = await new Parse.Query('RoleProfile')
      .equalTo('role', role)
      .include('user')
      .limit(1000)
      .find({ useMasterKey: true });
    await hydrateRoleProfilesMissingUser(profiles);

    for (const profile of profiles) {
      const entry = toProfileSearchResultFromRoleProfile(profile, role);
      if (!entry.userId) continue;
      if (!matchesProfileSearchQuery(entry, search)) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
    }
  }

  await appendUsersByPrimaryRole(byUserId, role, search);

  const roleKeywordSearch = searchMatchesRoleKeyword(search, role);
  // Busca por alias do papel (ex.: "prep") nao precisa varrer todas as inscricoes.
  if (!roleKeywordSearch || byUserId.size === 0) {
    const regQuery = new Parse.Query('EventRegistration');
    regQuery.equalTo('role', role);
    regQuery.descending('createdAt');
    regQuery.limit(2000);
    const registrations = await regQuery.find({ useMasterKey: true });

    for (const registration of registrations) {
      const entry = toProfileSearchResultFromRegistration(registration, role);
      if (!entry.userId) continue;
      if (!matchesProfileSearchQuery(entry, search)) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
    }
  }

  if (search.length > 0) {
    const rawQuery = String(request.params.query || '').trim();
    const profileQueries = [];

    if (isProfessionalProfileRole(role)) {
      const apelidoProfileQuery = new Parse.Query('RoleProfile');
      apelidoProfileQuery.equalTo('role', role);
      apelidoProfileQuery.matches('userApelido', rawQuery, 'i');
      const nameProfileQuery = new Parse.Query('RoleProfile');
      nameProfileQuery.equalTo('role', role);
      nameProfileQuery.matches('userName', rawQuery, 'i');
      const fullNameProfileQuery = new Parse.Query('RoleProfile');
      fullNameProfileQuery.equalTo('role', role);
      fullNameProfileQuery.matches('userFullName', rawQuery, 'i');
      profileQueries.push(apelidoProfileQuery, nameProfileQuery, fullNameProfileQuery);
    }

    const regApelidoQuery = new Parse.Query('EventRegistration');
    regApelidoQuery.equalTo('role', role);
    regApelidoQuery.matches('apelido', rawQuery, 'i');
    const regUserApelidoQuery = new Parse.Query('EventRegistration');
    regUserApelidoQuery.equalTo('role', role);
    regUserApelidoQuery.matches('userApelido', rawQuery, 'i');
    const regDisplayQuery = new Parse.Query('EventRegistration');
    regDisplayQuery.equalTo('role', role);
    regDisplayQuery.matches('userDisplayName', rawQuery, 'i');
    const regFullNameQuery = new Parse.Query('EventRegistration');
    regFullNameQuery.equalTo('role', role);
    regFullNameQuery.matches('userFullName', rawQuery, 'i');
    profileQueries.push(regApelidoQuery, regUserApelidoQuery, regDisplayQuery, regFullNameQuery);

    const extraResults = await Parse.Query.or(...profileQueries).limit(200).find({ useMasterKey: true });

    for (const row of extraResults) {
      const entry =
        row.className === 'RoleProfile'
          ? toProfileSearchResultFromRoleProfile(row, role)
          : toProfileSearchResultFromRegistration(row, role);
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
    }

    const apelidoUserQuery = new Parse.Query(Parse.User);
    apelidoUserQuery.matches('apelido', rawQuery, 'i');
    const nameUserQuery = new Parse.Query(Parse.User);
    nameUserQuery.matches('name', rawQuery, 'i');
    const matchedUsers = await Parse.Query.or(apelidoUserQuery, nameUserQuery)
      .limit(200)
      .find({ useMasterKey: true });

    if (matchedUsers.length) {
      const profileByUserId = new Map();
      if (isProfessionalProfileRole(role)) {
        const matchedUserIds = matchedUsers.map((user) => user.id).filter(Boolean);
        const byPointer = new Parse.Query('RoleProfile');
        byPointer.equalTo('role', role);
        byPointer.containedIn('user', matchedUsers);
        byPointer.include('user');
        const byUserIdField = new Parse.Query('RoleProfile');
        byUserIdField.equalTo('role', role);
        byUserIdField.containedIn('userId', matchedUserIds);
        byUserIdField.include('user');
        const roleProfiles = await Parse.Query.or(byPointer, byUserIdField)
          .limit(400)
          .find({ useMasterKey: true });
        await hydrateRoleProfilesMissingUser(roleProfiles);
        for (const profile of roleProfiles) {
          const user = profile.get('user');
          const userId = profile.get('userId') || (user && user.id ? user.id : '');
          if (userId) profileByUserId.set(userId, profile);
        }
      }

      const registrationByUserId = new Map();
      const byUser = new Parse.Query('EventRegistration');
      byUser.containedIn('user', matchedUsers);
      byUser.equalTo('role', role);
      byUser.descending('createdAt');
      const byParticipantId = new Parse.Query('EventRegistration');
      byParticipantId.containedIn(
        'participantUserId',
        matchedUsers.map((user) => user.id).filter(Boolean)
      );
      byParticipantId.equalTo('role', role);
      byParticipantId.descending('createdAt');
      const matchedRegistrations = await Parse.Query.or(byUser, byParticipantId)
        .limit(400)
        .find({ useMasterKey: true });
      for (const registration of matchedRegistrations) {
        const user = registration.get('user');
        const userId =
          registration.get('participantUserId') ||
          (user && user.id ? user.id : '');
        if (!userId || registrationByUserId.has(userId)) continue;
        registrationByUserId.set(userId, registration);
      }

      for (const user of matchedUsers) {
        if (!user.id) continue;
        let entry = null;
        if (profileByUserId.has(user.id)) {
          entry = toProfileSearchResultFromRoleProfile(profileByUserId.get(user.id), role);
        } else if (registrationByUserId.has(user.id)) {
          entry = toProfileSearchResultFromRegistration(registrationByUserId.get(user.id), role);
        } else if (user.get('primaryRole') === role) {
          const apelido = user.get('apelido') || '';
          const fullName = user.get('name') || '';
          entry = {
            userId: user.id,
            displayName: apelido || fullName || user.getUsername() || PROFILE_ROLE_LABELS[role],
            apelido: apelido || undefined,
            fullName: fullName || undefined,
            role,
            subtitle: PROFILE_ROLE_LABELS[role],
            city: user.get('address')?.city || undefined,
            state: user.get('address')?.state || undefined,
            avatarUrl: user.get('avatarUrl') || undefined,
          };
        }
        if (!entry || !entry.userId) continue;
        const existing = byUserId.get(entry.userId);
        byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
      }
    }
  }

  const ranked = Array.from(byUserId.values()).sort((a, b) => {
    if (search.length > 0) {
      const scoreDiff = profileRelevanceScore(b, search) - profileRelevanceScore(a, search);
      if (scoreDiff !== 0) return scoreDiff;
    }
    return a.displayName.localeCompare(b.displayName, 'pt-BR');
  });

  return ranked.slice(0, 100);
});

Parse.Cloud.define('getRolePublicProfile', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const role = String(request.params.role || '').trim();
  const userId = String(request.params.userId || '').trim();

  if (!SEARCHABLE_PROFILE_ROLES.includes(role)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Perfil invalido.');
  }
  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId obrigatorio.');
  }

  let roleProfileRow = null;
  if (isProfessionalProfileRole(role)) {
    const userPtr = Parse.User.createWithoutData(userId);
    roleProfileRow = await new Parse.Query('RoleProfile')
      .equalTo('user', userPtr)
      .equalTo('role', role)
      .first({ useMasterKey: true });
  }

  const registrations = await loadProfileRegistrationsForUser(userId, role);

  if (!roleProfileRow && !registrations.length) {
    return null;
  }

  let user = null;
  try {
    user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
  } catch (error) {
    if (!(error && error.code === Parse.Error.OBJECT_NOT_FOUND)) {
      throw error;
    }
  }

  const registration = registrations[0];
  const apelido =
    (user && user.get('apelido')) ||
    (registration && registration.get('apelido')) ||
    (registration && registration.get('userApelido')) ||
    '';
  const fullName =
    (user && user.get('name')) ||
    (registration && registration.get('userFullName')) ||
    '';
  const displayName =
    (registration && registration.get('userDisplayName')) ||
    apelido ||
    fullName ||
    (user && user.getUsername()) ||
    PROFILE_ROLE_LABELS[role];
  const address = (user && user.get('address')) || {};
  const birthDate = user && user.get('birthDate');
  const roleProfilePayload = roleProfileToPayload(roleProfileRow, role);
  const history = await buildRoleParticipationHistory(userId, role);

  return {
    userId,
    role,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    avatarUrl:
      (registration && registration.get('avatarUrl')) ||
      (user && user.get('avatarUrl')) ||
      undefined,
    state: address.state || undefined,
    city: address.city || undefined,
    neighborhood: address.neighborhood || undefined,
    age: calcAgeFromBirthDate(birthDate),
    proFootballIdol: readUserProFootballIdol(user),
    amateurFootballIdol: readUserAmateurFootballIdol(user),
    favoriteProTeam: readUserFavoriteProTeam(
      user,
      roleProfileRow ? roleProfileRow.get('favoriteProTeam') : undefined
    ),
    roleProfile: roleProfilePayload,
    history,
  };
});

// Escudo de times (SportsDB)
const TEAM_SHIELD_SEARCH_ALIASES = {
  sport: ['Sport Recife', 'Sport Club do Recife'],
  athletic: ['Athletic Club MG', 'Athletic Club Minas Gerais'],
  central: ['Central Esporte Clube', 'Central EC PE'],
  gas: ['GAS Esporte Clube', 'GAS Caracarai'],
  retro: ['Retro Futebol Clube', 'Retro FC Brasil'],
  abc: ['ABC Futebol Clube', 'ABC FC Natal'],
  csa: ['Centro Sportivo Alagoano', 'CSA Maceio'],
  crb: ['Clube de Regatas Brasil', 'CRB Maceio'],
  crac: ['Clube Recreativo e Atletico Catalano', 'CRAC Goiania'],
  iape: ['IAPE Futebol Clube', 'IAPE Maranhao'],
  asa: ['Agremiacao Sportiva Arapiraquense', 'ASA Arapiraca'],
  cse: ['Centro Sportivo Alagoano', 'CSE Alagoas'],
  mixto: ['Mixto Esporte Clube', 'Mixto Cuiaba'],
  botafogo: ['Botafogo de Futebol e Regatas', 'Botafogo RJ'],
  'botafogo-sp': ['Botafogo Futebol Clube SP', 'Botafogo SP'],
  'botafogo-pb': ['Botafogo Futebol Clube PB', 'Botafogo Paraiba'],
  guarani: ['Guarani Futebol Clube', 'Guarani Campinas'],
  santos: ['Santos FC', 'Santos Futebol Clube'],
  vitoria: ['Esporte Clube Vitoria', 'Vitoria BA'],
  nautico: ['Clube Nautico Capibaribe', 'Nautico Recife'],
  ceara: ['Ceara Sporting Club', 'Ceara Fortaleza'],
  'santa-cruz': ['Santa Cruz Futebol Clube', 'Santa Cruz Recife'],
  'fluminense-pi': ['Fluminense Esporte Clube PI', 'Fluminense PI'],
  'america-mineiro': ['America Futebol Clube MG', 'America Mineiro'],
  'america-de-natal': ['America Futebol Clube RN', 'America de Natal'],
  'america-rj': ['America Futebol Clube RJ', 'America Rio de Janeiro'],
  'atletico-mineiro': ['Clube Atletico Mineiro', 'Atletico Mineiro'],
  'atletico-goianiense': ['Atletico Goianiense', 'Atletico Clube Goianiense'],
  'atletico-cearense': ['Atletico Cearense', 'Atletico Cearense Fortaleza'],
  'operario-pr': ['Operario Ferroviario Esporte Clube', 'Operario PR'],
  'operario-vg': ['Operario Ferroviario VG', 'Operario Vila Galvao'],
  'operario-ms': ['Operario Ferroviario MS', 'Operario MS'],
  'sampaio-correa': ['Sampaio Correa Futebol Clube', 'Sampaio Correa MA'],
  portuguesa: ['Associacao Portuguesa de Desportos', 'Portuguesa SP'],
  ferroviario: ['Clube Ferroviario Atletico Clube', 'Ferroviario Fortaleza'],
  ferroviaria: ['Associacao Ferroviaria de Esportes', 'Ferroviaria Araraquara'],
};

function teamShieldSlug(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTeamShieldSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildTeamShieldSearchQueries(teamName, slug) {
  const resolvedSlug = slug || teamShieldSlug(teamName);
  const aliases = TEAM_SHIELD_SEARCH_ALIASES[resolvedSlug] || [];
  const fromSlug = resolvedSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const queries = [
    teamName,
    ...aliases,
    fromSlug,
    `${teamName} FC`,
    `${teamName} Esporte Clube`,
    `${teamName} Futebol Clube`,
  ];
  const seen = new Set();
  return queries
    .map((query) => String(query || '').trim())
    .filter(Boolean)
    .filter((query) => {
      const key = normalizeTeamShieldSearchText(query);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isBrazilianSportsDbTeam(team) {
  const country = String(team.strCountry || '').toLowerCase();
  if (country === 'brazil') return true;
  const leagues = [team.strLeague, team.strLeague2, team.strLeague3, team.strLeague4]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return (
    leagues.includes('brazil') ||
    leagues.includes('brasileir') ||
    leagues.includes('serie') ||
    leagues.includes('copa do brasil') ||
    leagues.includes('campeonato')
  );
}

function scoreSportsDbTeamMatch(team, queries) {
  let score = 0;
  if (isBrazilianSportsDbTeam(team)) score += 100;
  const names = [team.strTeam, team.strTeamAlternate]
    .map((value) => normalizeTeamShieldSearchText(value))
    .filter(Boolean);
  for (const query of queries) {
    const normalizedQuery = normalizeTeamShieldSearchText(query);
    if (!normalizedQuery) continue;
    for (const name of names) {
      if (name === normalizedQuery) score += 60;
      else if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) score += 25;
      else {
        const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 2);
        score += tokens.filter((token) => name.includes(token)).length * 8;
      }
    }
  }
  if (team.strBadge || team.strTeamBadge) score += 5;
  return score;
}

async function searchSportsDbTeams(query) {
  const response = await Parse.Cloud.httpRequest({
    url: `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(query)}`,
    followRedirects: true,
  });
  const body = response.data || {};
  return Array.isArray(body.teams) ? body.teams : [];
}

async function resolveTeamShieldUrlFromSportsDb(teamName, slug) {
  const queries = buildTeamShieldSearchQueries(teamName, slug);
  const candidates = new Map();

  for (const query of queries) {
    const teams = await searchSportsDbTeams(query);
    for (const team of teams) {
      const score = scoreSportsDbTeamMatch(team, queries);
      if (score < 30) continue;
      const key = String(team.idTeam || team.strTeam || '');
      const previous = candidates.get(key) || { team, score: 0 };
      previous.score = Math.max(previous.score, score);
      candidates.set(key, previous);
    }
  }

  const ranked = Array.from(candidates.values()).sort((a, b) => b.score - a.score);
  const best =
    ranked.find((entry) => isBrazilianSportsDbTeam(entry.team)) ||
    ranked[0];
  if (!best) return null;

  const badge = best.team.strBadge || best.team.strTeamBadge;
  return badge ? String(badge) : null;
}

Parse.Cloud.define('resolveTeamShieldUrl', async (request) => {
  const teamName = request.params.teamName ? String(request.params.teamName).trim() : '';
  const slug = request.params.slug ? String(request.params.slug).trim() : '';
  if (!teamName) {
    return { url: null };
  }

  const cacheKey = slug ? `${slug}::${teamName}` : teamName;
  const config = await Parse.Config.get({ useMasterKey: true });
  const cache = config.get('teamBadgeUrls') || {};
  if (cache[cacheKey]) {
    return { url: cache[cacheKey] };
  }
  if (cache[teamName]) {
    return { url: cache[teamName] };
  }

  try {
    const url = await resolveTeamShieldUrlFromSportsDb(teamName, slug);
    if (url) {
      cache[cacheKey] = url;
      cache[teamName] = url;
      await Parse.Config.save({ teamBadgeUrls: cache }, { useMasterKey: true });
      return { url };
    }
  } catch {
    // fallback handled on client
  }

  return { url: null };
});

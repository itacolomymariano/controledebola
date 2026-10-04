/** Desafio entre times (MatchChallenge) + resumo do dia do confronto */

function isoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function matchChallengeReturnEnd(returnStart, proposedStart, proposedEnd) {
  const startMs = proposedStart ? new Date(proposedStart).getTime() : NaN;
  const endMs = proposedEnd ? new Date(proposedEnd).getTime() : NaN;
  const durationMs =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? endMs - startMs
      : 2 * 60 * 60 * 1000;
  return new Date(returnStart.getTime() + durationMs);
}

function mapMatchChallengeRow(row) {
  const challengerTeam = row.get('challengerTeam');
  const challengedTeam = row.get('challengedTeam');
  const proposedStart = row.get('proposedStartTime');
  const proposedEnd = row.get('proposedEndTime');
  return {
    objectId: row.id,
    status: row.get('status') || 'pending',
    message: row.get('message') || '',
    challengeConditions: row.get('challengeConditions') || '',
    returnChallengeConditions: row.get('returnChallengeConditions') || '',
    hasReturnLeg: !!row.get('hasReturnLeg'),
    returnStartTime: isoOrNull(row.get('returnStartTime')),
    returnEndTime: isoOrNull(row.get('returnEndTime')),
    returnLocationComplement: row.get('returnLocationComplement') || '',
    returnAddress: row.get('returnAddress') || null,
    eventId: row.get('eventId') || '',
    returnEventId: row.get('returnEventId') || '',
    declineReason: row.get('declineReason') || '',
    proposedStartTime: proposedStart ? proposedStart.toISOString() : null,
    proposedEndTime: proposedEnd ? proposedEnd.toISOString() : null,
    proposedAddress: row.get('proposedAddress') || {},
    proposedLocationComplement: row.get('proposedLocationComplement') || '',
    challengerTeamId: challengerTeam && challengerTeam.id ? challengerTeam.id : '',
    challengedTeamId: challengedTeam && challengedTeam.id ? challengedTeam.id : '',
    challengerTeamName: row.get('challengerTeamName') || '',
    challengedTeamName: row.get('challengedTeamName') || '',
    challengerUserId: row.get('challengerUser') && row.get('challengerUser').id
      ? row.get('challengerUser').id
      : '',
    challengedUserId: row.get('challengedUser') && row.get('challengedUser').id
      ? row.get('challengedUser').id
      : '',
    createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : null,
  };
}

Parse.Cloud.define('createMatchChallenge', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const challengedTeamId = String(request.params.challengedTeamId || '').trim();
  const challengerTeamId = String(request.params.challengerTeamId || '').trim();
  const message = String(request.params.message || '').trim().slice(0, 1000);
  const challengeConditions = String(request.params.challengeConditions || '').trim().slice(0, 2000);
  const hasReturnLeg = !!request.params.hasReturnLeg;
  const proposedStartTime = request.params.proposedStartTime
    ? new Date(request.params.proposedStartTime)
    : null;
  const proposedEndTime = request.params.proposedEndTime
    ? new Date(request.params.proposedEndTime)
    : null;
  if (
    !proposedStartTime ||
    Number.isNaN(proposedStartTime.getTime()) ||
    !proposedEndTime ||
    Number.isNaN(proposedEndTime.getTime())
  ) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe data e hora desejadas para o confronto.'
    );
  }
  if (proposedEndTime <= proposedStartTime) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino deve ser apos o inicio.');
  }
  const proposedAddress =
    request.params.proposedAddress && typeof request.params.proposedAddress === 'object'
      ? request.params.proposedAddress
      : {};
  const proposedLocationComplement = String(request.params.proposedLocationComplement || '').trim();
  const city = String(proposedAddress.city || '').trim();
  const state = String(proposedAddress.state || '').trim();
  if (!city || !state) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe o local desejado (cidade e UF no minimo).'
    );
  }
  if (!challengedTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione o time desafiado.');
  }
  if (!challengerTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione o seu time desafiante.');
  }

  const myTeams = await new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .limit(5)
    .find({ useMasterKey: true });
  if (!myTeams.length) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Cadastre seu time antes de desafiar.');
  }
  const challengerTeam = myTeams.find((team) => team.id === challengerTeamId);
  if (!challengerTeam) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce so pode desafiar com um time do qual e presidente.'
    );
  }
  if (challengerTeam.id === challengedTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel desafiar o proprio time.');
  }

  const challengedTeam = await new Parse.Query('AmateurTeam')
    .include('president')
    .get(challengedTeamId, { useMasterKey: true });
  const challengedPresident = challengedTeam.get('president');
  if (!challengedPresident || !challengedPresident.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time desafiado sem presidente.');
  }
  if (challengedPresident.id === user.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel desafiar o proprio time.');
  }

  const pending = await new Parse.Query('MatchChallenge')
    .equalTo('challengerTeam', challengerTeam)
    .equalTo('challengedTeam', challengedTeam)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });
  if (pending) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Ja existe um desafio pendente para este time.');
  }

  if (typeof assertTeamsFreeForProposedMatch === 'function') {
    await assertTeamsFreeForProposedMatch(
      challengerTeam,
      challengedTeam,
      proposedStartTime,
      proposedEndTime,
      {}
    );
  }

  const challenge = new Parse.Object('MatchChallenge');
  challenge.set('challengerTeam', challengerTeam);
  challenge.set('challengedTeam', challengedTeam);
  challenge.set('challengerUser', user);
  challenge.set('challengedUser', challengedPresident);
  challenge.set('challengerTeamName', challengerTeam.get('name') || '');
  challenge.set('challengedTeamName', challengedTeam.get('name') || '');
  challenge.set('message', message);
  if (challengeConditions) challenge.set('challengeConditions', challengeConditions);
  challenge.set('hasReturnLeg', hasReturnLeg);
  challenge.set('proposedStartTime', proposedStartTime);
  challenge.set('proposedEndTime', proposedEndTime);
  challenge.set('proposedAddress', proposedAddress);
  challenge.set('proposedLocationComplement', proposedLocationComplement);
  challenge.set('status', 'pending');
  const acl = new Parse.ACL();
  acl.setReadAccess(user.id, true);
  acl.setWriteAccess(user.id, true);
  acl.setReadAccess(challengedPresident.id, true);
  acl.setWriteAccess(challengedPresident.id, true);
  challenge.setACL(acl);
  await challenge.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(challengedPresident.id, {
      title: 'Desafio de confronto',
      alert: `${challengerTeam.get('name') || 'Um time'} te desafiou. Veja na caixa de entrada.`,
      data: {
        type: 'match_challenge',
        challengeId: challenge.id,
      },
    });
  } catch (error) {
    console.error('createMatchChallenge push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(proposedStartTime) : '';
    await createAppMessage({
      recipientId: challengedPresident.id,
      senderId: user.id,
      kind: 'match_challenge',
      title: `Desafio de ${challengerTeam.get('name') || 'um time'}`,
      body:
        `${challengerTeam.get('name') || 'Um time'} desafiou ${challengedTeam.get('name') || 'seu time'}` +
        (dateLabel ? ` para ${dateLabel}.` : '.') +
        ' Responda na Entrada.',
      relatedClass: 'MatchChallenge',
      relatedId: challenge.id,
      actionRoute: '/inbox',
    });
  }

  return mapMatchChallengeRow(challenge);
});

Parse.Cloud.define('respondMatchChallenge', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const challengeId = String(request.params.challengeId || '').trim();
  const decision = String(request.params.decision || '').trim();
  const declineReason = String(request.params.declineReason || '').trim().slice(0, 500);
  const returnLocationComplement = String(request.params.returnLocationComplement || '')
    .trim()
    .slice(0, 300);
  const returnStartRaw = request.params.returnStartTime
    ? new Date(request.params.returnStartTime)
    : null;
  const returnStart =
    returnStartRaw && !Number.isNaN(returnStartRaw.getTime()) ? returnStartRaw : null;
  if (!challengeId || (decision !== 'accepted' && decision !== 'declined')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o desafio e a decisao.');
  }
  if (decision === 'declined' && declineReason.length < 3) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o motivo da rejeicao.');
  }

  const challenge = await new Parse.Query('MatchChallenge')
    .include('challengerUser')
    .include('challengedUser')
    .include('challengerTeam')
    .include('challengedTeam')
    .get(challengeId, { useMasterKey: true });
  const challengedUser = challenge.get('challengedUser');
  if (!challengedUser || challengedUser.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o presidente desafiado pode responder.');
  }
  if (challenge.get('status') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este desafio ja foi respondido.');
  }

  if (decision === 'accepted') {
    const proposedStart = challenge.get('proposedStartTime');
    const proposedEnd = challenge.get('proposedEndTime');
    if (
      !proposedStart ||
      !proposedEnd ||
      Number.isNaN(new Date(proposedStart).getTime()) ||
      Number.isNaN(new Date(proposedEnd).getTime())
    ) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Este desafio nao tem data/hora propostas. Peca um novo convite.'
      );
    }
    if (challenge.get('hasReturnLeg')) {
      if (!returnStart) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          'Informe data e hora da volta.'
        );
      }
      if (returnLocationComplement.length < 3) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          'Informe o local da volta (voce sera o mandante).'
        );
      }
    }
    const challengerTeam = challenge.get('challengerTeam');
    const challengedTeam = challenge.get('challengedTeam');
    let homeTeam = challengerTeam;
    let awayTeam = challengedTeam;
    if (challengerTeam && challengerTeam.id && (!challengerTeam.get || !challengerTeam.get('president'))) {
      homeTeam = await new Parse.Query('AmateurTeam')
        .include('president')
        .get(challengerTeam.id, { useMasterKey: true });
    }
    if (challengedTeam && challengedTeam.id && (!challengedTeam.get || !challengedTeam.get('president'))) {
      awayTeam = await new Parse.Query('AmateurTeam')
        .include('president')
        .get(challengedTeam.id, { useMasterKey: true });
    }
    if (typeof assertTeamsFreeForProposedMatch === 'function') {
      await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, proposedStart, proposedEnd, {
        excludeChallengeId: challenge.id,
      });
      if (challenge.get('hasReturnLeg') && returnStart) {
        const returnEndPreview = matchChallengeReturnEnd(returnStart, proposedStart, proposedEnd);
        await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, returnStart, returnEndPreview, {
          excludeChallengeId: challenge.id,
        });
      }
    }
  }

  challenge.set('status', decision);
  if (decision === 'declined') challenge.set('declineReason', declineReason);
  if (decision === 'accepted' && challenge.get('hasReturnLeg') && returnStart) {
    const returnEnd = matchChallengeReturnEnd(
      returnStart,
      challenge.get('proposedStartTime'),
      challenge.get('proposedEndTime')
    );
    const proposedAddress = challenge.get('proposedAddress');
    const returnAddress =
      proposedAddress && typeof proposedAddress === 'object' && !Array.isArray(proposedAddress)
        ? { ...proposedAddress, locationComplement: returnLocationComplement }
        : null;
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(returnStart) : '';
    const summary = (
      dateLabel
        ? `Volta: ${dateLabel} — ${returnLocationComplement}`
        : `Volta: ${returnLocationComplement}`
    ).slice(0, 2000);
    challenge.set('returnStartTime', returnStart);
    challenge.set('returnEndTime', returnEnd);
    challenge.set('returnLocationComplement', returnLocationComplement);
    if (returnAddress) challenge.set('returnAddress', returnAddress);
    challenge.set('returnChallengeConditions', summary);
  }
  await challenge.save(null, { useMasterKey: true });

  const challengerUser = challenge.get('challengerUser');
  if (challengerUser && challengerUser.id) {
    try {
      await sendPushToUser(challengerUser.id, {
        title: decision === 'accepted' ? 'Desafio aceito' : 'Desafio recusado',
        alert:
          decision === 'accepted'
            ? `${challenge.get('challengedTeamName') || 'O adversario'} aceitou o desafio. Marque o confronto.`
            : `${challenge.get('challengedTeamName') || 'O adversario'} recusou: ${declineReason}`,
        data: {
          type: 'match_challenge_response',
          challengeId: challenge.id,
          decision,
        },
      });
    } catch (error) {
      console.error('respondMatchChallenge push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      const challengedName = challenge.get('challengedTeamName') || 'O adversario';
      await createAppMessage({
        recipientId: challengerUser.id,
        senderId: user.id,
        kind: 'match_challenge_response',
        title: decision === 'accepted' ? 'Desafio aceito' : 'Desafio recusado',
        body:
          decision === 'accepted'
            ? `${challengedName} aceitou o desafio. Marque o confronto na Saida.`
            : `${challengedName} recusou o desafio. Motivo: ${declineReason || 'nao informado'}.`,
        relatedClass: 'MatchChallenge',
        relatedId: challenge.id,
        actionRoute: '/inbox?box=out',
      });
    }
  }

  return mapMatchChallengeRow(challenge);
});

Parse.Cloud.define('listMyMatchChallenges', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const asChallenger = new Parse.Query('MatchChallenge').equalTo('challengerUser', user);
  const asChallenged = new Parse.Query('MatchChallenge').equalTo('challengedUser', user);
  const rows = await Parse.Query.or(asChallenger, asChallenged)
    .descending('createdAt')
    .limit(50)
    .find({ useMasterKey: true });
  return rows.map(mapMatchChallengeRow);
});

Parse.Cloud.define('getAcceptedMatchChallenge', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const challengeId = String(request.params.challengeId || '').trim();
  if (!challengeId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o desafio.');
  }
  const challenge = await new Parse.Query('MatchChallenge')
    .include('challengerTeam')
    .include('challengedTeam')
    .get(challengeId, { useMasterKey: true });
  if (challenge.get('status') !== 'accepted') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O desafio precisa estar aceito.');
  }
  const challengerUser = challenge.get('challengerUser');
  const challengedUser = challenge.get('challengedUser');
  if (
    !challengerUser ||
    !challengedUser ||
    (challengerUser.id !== user.id && challengedUser.id !== user.id)
  ) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem acesso a este desafio.');
  }
  return {
    ...mapMatchChallengeRow(challenge),
    homeTeamId: challenge.get('challengerTeam') && challenge.get('challengerTeam').id,
    awayTeamId: challenge.get('challengedTeam') && challenge.get('challengedTeam').id,
  };
});

Parse.Cloud.define('getTeamMatchMatchdaySummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }
  const event = await new Parse.Query('Event')
    .include('homeTeam')
    .include('awayTeam')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Resumo disponivel apenas para confrontos.');
  }

  let actual = { homeScore: 0, awayScore: 0, goalScorers: [] };
  if (typeof buildEventActualPredictionResults === 'function') {
    actual = await buildEventActualPredictionResults(event);
  }

  const homeTeamName =
    event.get('homeTeamName') ||
    (event.get('homeTeam') && event.get('homeTeam').get
      ? event.get('homeTeam').get('name')
      : '') ||
    'Mandante';
  const awayTeamName =
    event.get('awayTeamName') ||
    (event.get('awayTeam') && event.get('awayTeam').get
      ? event.get('awayTeam').get('name')
      : '') ||
    'Visitante';
  const homeShieldFile =
    event.get('homeTeam') && event.get('homeTeam').get
      ? event.get('homeTeam').get('shieldImage')
      : null;
  const awayShieldFile =
    event.get('awayTeam') && event.get('awayTeam').get
      ? event.get('awayTeam').get('shieldImage')
      : null;
  const homeTeamShieldUrl =
    homeShieldFile && homeShieldFile.url ? homeShieldFile.url() : undefined;
  const awayTeamShieldUrl =
    awayShieldFile && awayShieldFile.url ? awayShieldFile.url() : undefined;

  const scorers = [];
  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .include('user')
    .limit(200)
    .find({ useMasterKey: true });

  for (const perf of performances) {
    // Confronto: lista de gols do placar usa apenas o apontamento do arbitro.
    const goals =
      event.get('type') === 'team_match'
        ? Number(perf.get('refereeGoals') || 0)
        : Math.max(Number(perf.get('goals') || 0), Number(perf.get('refereeGoals') || 0));
    if (goals <= 0) continue;
    const u = perf.get('user');
    if (!u || !u.id) continue;
    let age = null;
    let position = '';
    let avatarUrl = undefined;
    try {
      const full = await new Parse.Query(Parse.User).get(u.id, { useMasterKey: true });
      age = ageFromBirthDate(full.get('birthDate'));
      const avatar = full.get('avatar');
      if (avatar && avatar.url) avatarUrl = avatar.url();
      const profile = await new Parse.Query('AthleteProfile')
        .equalTo('user', full)
        .first({ useMasterKey: true });
      if (profile) position = String(profile.get('primaryPosition') || '').trim();
    } catch {
      // ignore
    }
    const reg = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .equalTo('user', u)
      .first({ useMasterKey: true });
    const teamSide = reg ? reg.get('teamSide') || null : null;
    let teamName = '';
    if (teamSide === 'home') teamName = homeTeamName;
    else if (teamSide === 'away') teamName = awayTeamName;
    scorers.push({
      userId: u.id,
      name: (u.get && (u.get('apelido') || u.get('name') || u.getUsername())) || 'Atleta',
      goals,
      position,
      age,
      avatarUrl,
      teamSide,
      teamName,
    });
  }
  scorers.sort((a, b) => b.goals - a.goals);

  let referee = null;
  const refReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'referee')
    .include('user')
    .first({ useMasterKey: true });
  let refereeUser = refReg && refReg.get('user') ? refReg.get('user') : null;
  if (!refereeUser) {
    const acceptedInvite = await new Parse.Query('RefereeInvitation')
      .equalTo('event', event)
      .equalTo('role', 'referee')
      .equalTo('status', 'accepted')
      .include('invitedUser')
      .descending('updatedAt')
      .first({ useMasterKey: true });
    if (acceptedInvite && acceptedInvite.get('invitedUser')) {
      refereeUser = acceptedInvite.get('invitedUser');
    }
  }
  if (refereeUser) {
    const ru = refereeUser;
    let age = null;
    let avatarUrl = undefined;
    try {
      const full = await new Parse.Query(Parse.User).get(ru.id, { useMasterKey: true });
      age = ageFromBirthDate(full.get('birthDate'));
      const avatar = full.get('avatar');
      if (avatar && avatar.url) avatarUrl = avatar.url();
    } catch {
      // ignore
    }
    let score = null;
    try {
      // MuralVote de evento usa scope/scopeId (nao pointer event).
      const votes = await new Parse.Query('MuralVote')
        .equalTo('scope', 'event')
        .equalTo('scopeId', event.id)
        .equalTo('targetRole', 'referee')
        .equalTo('targetUser', Parse.User.createWithoutData(ru.id))
        .limit(200)
        .find({ useMasterKey: true });
      if (votes.length) {
        const sum = votes.reduce((acc, v) => acc + Number(v.get('score') || 0), 0);
        score = Math.round((sum / votes.length) * 10) / 10;
      }
    } catch {
      score = null;
    }
    referee = {
      userId: ru.id,
      name: (ru.get && (ru.get('apelido') || ru.get('name') || ru.getUsername())) || 'Arbitro',
      age,
      avatarUrl,
      score,
    };
  }

  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], {
    useMasterKey: true,
  });

  let canSeeConditions = false;
  const admin = event.get('admin');
  if (admin && admin.id === request.user.id) {
    canSeeConditions = true;
  } else {
    for (const team of [event.get('homeTeam'), event.get('awayTeam')]) {
      if (!team) continue;
      const president = team.get('president');
      if (president && president.id === request.user.id) {
        canSeeConditions = true;
        break;
      }
    }
  }

  return {
    eventId: event.id,
    homeTeamName,
    awayTeamName,
    homeTeamShieldUrl,
    awayTeamShieldUrl,
    homeScore: Number(actual.homeScore || 0),
    awayScore: Number(actual.awayScore || 0),
    scorers,
    referee,
    challengeConditions: canSeeConditions ? event.get('challengeConditions') || '' : '',
    homeAcceptsUninvitedAthletes: !!event.get('homeAcceptsUninvitedAthletes'),
    awayAcceptsUninvitedAthletes: !!event.get('awayAcceptsUninvitedAthletes'),
    athleteConvocationBy:
      event.get('athleteConvocationBy') === 'coach' ? 'coach' : 'president',
  };
});

const TEAM_MATCH_REASON_MIN_LEN = 8;
const TEAM_MATCH_RESCHEDULE_MIN_DELTA_MS =
  typeof RESCHEDULE_MIN_DELTA_MS === 'number' ? RESCHEDULE_MIN_DELTA_MS : 15 * 60 * 1000;

async function assertTeamMatchScheduleManager(event, user) {
  const admin = event.get('admin');
  if (admin && admin.id === user.id) return;

  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], { useMasterKey: true });
  for (const team of [event.get('homeTeam'), event.get('awayTeam')]) {
    if (!team) continue;
    const president = team.get('president');
    if (president && president.id === user.id) return;
  }

  throw new Parse.Error(
    Parse.Error.OPERATION_FORBIDDEN,
    'Apenas presidentes dos times ou quem marcou o confronto podem alterar a agenda.'
  );
}

function normalizeTeamMatchReason(raw) {
  const reason = String(raw || '').trim();
  if (reason.length < TEAM_MATCH_REASON_MIN_LEN) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Informe o motivo com pelo menos ${TEAM_MATCH_REASON_MIN_LEN} caracteres.`
    );
  }
  return reason.slice(0, 500);
}

Parse.Cloud.define('cancelTeamMatch', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const reason = normalizeTeamMatchReason(request.params.reason);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este confronto ja foi encerrado.');
  }
  const startTime = event.get('startTime');
  const startMs = startTime instanceof Date ? startTime.getTime() : new Date(startTime || 0).getTime();
  if (!Number.isNaN(startMs) && startMs <= Date.now()) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel cancelar apos o inicio.');
  }

  await assertTeamMatchScheduleManager(event, user);
  clearPendingTeamMatchReschedule(event);
  event.set('isFinished', true);
  event.set('lastScheduleChangeReason', reason);
  event.set('lastScheduleChangeBy', user);
  event.set('lastScheduleChangeAt', new Date());
  await event.save(null, { useMasterKey: true });

  return { ok: true, eventId: event.id, isFinished: true };
});

async function loadTeamMatchPresidents(event) {
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], { useMasterKey: true });
  const seen = new Set();
  const presidents = [];
  for (const team of [event.get('homeTeam'), event.get('awayTeam')]) {
    if (!team) continue;
    const president = team.get('president');
    if (!president || !president.id || seen.has(president.id)) continue;
    seen.add(president.id);
    presidents.push(president);
  }
  return presidents;
}

function clearPendingTeamMatchReschedule(event) {
  event.unset('pendingRescheduleStartTime');
  event.unset('pendingRescheduleEndTime');
  event.unset('pendingRescheduleReason');
  event.unset('pendingRescheduleRequestedBy');
  event.unset('pendingRescheduleRequestedAt');
  event.unset('pendingRescheduleStatus');
}

function mapPendingRescheduleRow(event) {
  const requestedBy = event.get('pendingRescheduleRequestedBy');
  const start = event.get('pendingRescheduleStartTime');
  const end = event.get('pendingRescheduleEndTime');
  const currentStart = event.get('startTime');
  return {
    eventId: event.id,
    eventName: event.get('name') || '',
    homeTeamName: event.get('homeTeamName') || 'Mandante',
    awayTeamName: event.get('awayTeamName') || 'Visitante',
    currentStartTime: currentStart ? currentStart.toISOString() : null,
    proposedStartTime: start ? start.toISOString() : null,
    proposedEndTime: end ? end.toISOString() : null,
    reason: event.get('pendingRescheduleReason') || '',
    requestedByUserId: requestedBy && requestedBy.id ? requestedBy.id : '',
    requestedAt: event.get('pendingRescheduleRequestedAt')
      ? event.get('pendingRescheduleRequestedAt').toISOString()
      : null,
    status: event.get('pendingRescheduleStatus') || 'pending',
  };
}

async function applyTeamMatchReschedule(event, user, startTime, endTime, reason) {
  event.set('startTime', startTime);
  event.set('endTime', endTime);
  event.set('lastScheduleChangeReason', reason);
  event.set('lastScheduleChangeBy', user);
  event.set('lastScheduleChangeAt', new Date());
  clearPendingTeamMatchReschedule(event);
  await event.save(null, { useMasterKey: true });
}

/** Propoe remarcacao; se nao houver outro presidente, aplica na hora. */
Parse.Cloud.define('rescheduleTeamMatch', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const reason = normalizeTeamMatchReason(request.params.reason);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }

  const startTime = request.params.startTime ? new Date(request.params.startTime) : null;
  const endTime = request.params.endTime ? new Date(request.params.endTime) : null;
  if (!startTime || Number.isNaN(startTime.getTime()) || !endTime || Number.isNaN(endTime.getTime())) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe data e hora do confronto.');
  }
  if (endTime <= startTime) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino deve ser apos o inicio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este confronto ja foi encerrado.');
  }
  if (event.get('pendingRescheduleStatus') === 'pending') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ja existe uma proposta de remarcacao pendente para este confronto.'
    );
  }

  const oldStart = event.get('startTime');
  const oldStartMs = oldStart instanceof Date ? oldStart.getTime() : new Date(oldStart || 0).getTime();
  if (!Number.isNaN(oldStartMs) && oldStartMs <= Date.now()) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel remarcar apos o inicio.');
  }
  if (
    !Number.isNaN(oldStartMs) &&
    Math.abs(startTime.getTime() - oldStartMs) < TEAM_MATCH_RESCHEDULE_MIN_DELTA_MS
  ) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'A nova data deve diferir pelo menos 15 minutos da anterior.'
    );
  }

  await assertTeamMatchScheduleManager(event, user);
  const presidents = await loadTeamMatchPresidents(event);
  const counterparts = presidents.filter((president) => president.id !== user.id);

  if (!counterparts.length) {
    await applyTeamMatchReschedule(event, user, startTime, endTime, reason);
    return {
      ok: true,
      pending: false,
      eventId: event.id,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };
  }

  event.set('pendingRescheduleStartTime', startTime);
  event.set('pendingRescheduleEndTime', endTime);
  event.set('pendingRescheduleReason', reason);
  event.set('pendingRescheduleRequestedBy', user);
  event.set('pendingRescheduleRequestedAt', new Date());
  event.set('pendingRescheduleStatus', 'pending');
  await event.save(null, { useMasterKey: true });

  const eventName = event.get('name') || 'confronto';
  const dateLabel =
    typeof formatEventPushDate === 'function' ? formatEventPushDate(startTime) : '';
  for (const counterpart of counterparts) {
    try {
      await sendPushToUser(counterpart.id, {
        title: 'Remarcacao de confronto',
        alert: dateLabel
          ? `Proposta de remarcar "${eventName}" para ${dateLabel}. Veja na caixa de entrada.`
          : `Proposta de remarcar "${eventName}". Veja na caixa de entrada.`,
        data: {
          type: 'team_match_reschedule_request',
          eventId: event.id,
        },
      });
    } catch (error) {
      console.error('rescheduleTeamMatch push failed', error);
    }
  }

  if (typeof createAppMessages === 'function') {
    await createAppMessages(
      counterparts.map((counterpart) => counterpart.id),
      {
        senderId: user.id,
        kind: 'team_match_reschedule_request',
        title: 'Proposta de remarcacao',
        body:
          `Proposta de remarcar "${eventName}"` +
          (dateLabel ? ` para ${dateLabel}.` : '.') +
          (reason ? ` Motivo: ${reason}.` : '') +
          ' Aceite ou recuse na Entrada.',
        relatedClass: 'Event',
        relatedId: event.id,
        actionRoute: '/inbox',
      }
    );
  }

  return {
    ok: true,
    pending: true,
    eventId: event.id,
    proposedStartTime: startTime.toISOString(),
    proposedEndTime: endTime.toISOString(),
    awaitingPresidents: counterparts.length,
  };
});

Parse.Cloud.define('respondTeamMatchReschedule', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const decision = String(request.params.decision || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }
  if (decision !== 'accepted' && decision !== 'declined') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe accepted ou declined.');
  }

  const event = await new Parse.Query('Event')
    .include('pendingRescheduleRequestedBy')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('pendingRescheduleStatus') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao ha proposta de remarcacao pendente.');
  }

  const requestedBy = event.get('pendingRescheduleRequestedBy');
  if (requestedBy && requestedBy.id === user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Quem pediu a remarcacao nao pode aceitar a propria proposta.'
    );
  }

  const presidents = await loadTeamMatchPresidents(event);
  const isCounterpart = presidents.some((president) => president.id === user.id);
  if (!isCounterpart) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o presidente do time adversario pode responder a remarcacao.'
    );
  }

  const proposedStart = event.get('pendingRescheduleStartTime');
  const proposedEnd = event.get('pendingRescheduleEndTime');
  const reason = String(event.get('pendingRescheduleReason') || '').trim();
  const eventName = event.get('name') || 'confronto';
  const requesterId = requestedBy && requestedBy.id ? requestedBy.id : '';

  if (decision === 'declined') {
    const declineReason = String(request.params.declineReason || '').trim().slice(0, 500);
    clearPendingTeamMatchReschedule(event);
    await event.save(null, { useMasterKey: true });
    if (requesterId) {
      try {
        await sendPushToUser(requesterId, {
          title: 'Remarcacao recusada',
          alert: declineReason
            ? `A remarcacao de "${eventName}" foi recusada. Motivo: ${declineReason}`
            : `A remarcacao de "${eventName}" foi recusada.`,
          data: {
            type: 'team_match_reschedule_response',
            eventId: event.id,
            decision: 'declined',
          },
        });
      } catch (error) {
        console.error('respondTeamMatchReschedule decline push failed', error);
      }

      if (typeof createAppMessage === 'function') {
        await createAppMessage({
          recipientId: requesterId,
          senderId: user.id,
          kind: 'team_match_reschedule_response',
          title: 'Remarcacao recusada',
          body:
            `A remarcacao de "${eventName}" foi recusada pelo adversario.` +
            (declineReason ? ` Motivo: ${declineReason}.` : ''),
          relatedClass: 'Event',
          relatedId: event.id,
          actionRoute: `/event/${event.id}`,
        });
      }
    }
    return { ok: true, decision: 'declined', eventId: event.id };
  }

  if (
    !proposedStart ||
    !proposedEnd ||
    Number.isNaN(new Date(proposedStart).getTime()) ||
    Number.isNaN(new Date(proposedEnd).getTime())
  ) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Proposta de remarcacao invalida.');
  }

  await applyTeamMatchReschedule(
    event,
    user,
    new Date(proposedStart),
    new Date(proposedEnd),
    reason || 'Remarcacao aceita pelo adversario'
  );

  if (requesterId) {
    const acceptedDateLabel =
      typeof formatEventPushDate === 'function'
        ? formatEventPushDate(event.get('startTime'))
        : '';
    try {
      await sendPushToUser(requesterId, {
        title: 'Remarcacao aceita',
        alert: acceptedDateLabel
          ? `Remarcacao de "${eventName}" aceita para ${acceptedDateLabel}.`
          : `Remarcacao de "${eventName}" aceita.`,
        data: {
          type: 'team_match_reschedule_response',
          eventId: event.id,
          decision: 'accepted',
        },
      });
    } catch (error) {
      console.error('respondTeamMatchReschedule accept push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      await createAppMessage({
        recipientId: requesterId,
        senderId: user.id,
        kind: 'team_match_reschedule_response',
        title: 'Remarcacao aceita',
        body:
          `O adversario aceitou remarcar "${eventName}"` +
          (acceptedDateLabel ? ` para ${acceptedDateLabel}.` : '.'),
        relatedClass: 'Event',
        relatedId: event.id,
        actionRoute: `/event/${event.id}`,
      });
    }
  }

  return {
    ok: true,
    decision: 'accepted',
    eventId: event.id,
    startTime: event.get('startTime') ? event.get('startTime').toISOString() : null,
    endTime: event.get('endTime') ? event.get('endTime').toISOString() : null,
  };
});

Parse.Cloud.define('listPendingTeamMatchReschedules', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teams = await new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .limit(5)
    .find({ useMasterKey: true });
  if (!teams.length) return [];

  const homeQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('pendingRescheduleStatus', 'pending')
    .containedIn('homeTeam', teams);
  const awayQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('pendingRescheduleStatus', 'pending')
    .containedIn('awayTeam', teams);
  const rows = await Parse.Query.or(homeQ, awayQ)
    .include('pendingRescheduleRequestedBy')
    .descending('pendingRescheduleRequestedAt')
    .limit(30)
    .find({ useMasterKey: true });

  return rows
    .filter((event) => {
      const requestedBy = event.get('pendingRescheduleRequestedBy');
      return !(requestedBy && requestedBy.id === user.id);
    })
    .map(mapPendingRescheduleRow);
});

Parse.Cloud.define('getTeamMatchPendingReschedule', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }
  const event = await new Parse.Query('Event')
    .include('pendingRescheduleRequestedBy')
    .get(eventId, { useMasterKey: true });
  if (event.get('pendingRescheduleStatus') !== 'pending') {
    return null;
  }
  return mapPendingRescheduleRow(event);
});

function mapTeamMatchJoinRequestRow(row) {
  const event = row.get('event');
  const athlete = row.get('athlete');
  const president = row.get('president');
  return {
    objectId: row.id,
    status: row.get('status') || 'pending',
    teamSide: row.get('teamSide') || '',
    teamName: row.get('teamName') || '',
    eventId: event && event.id ? event.id : '',
    eventName: row.get('eventName') || (event && event.get ? event.get('name') : '') || 'Confronto',
    eventStartTime: (() => {
      const start =
        row.get('eventStartTime') || (event && event.get ? event.get('startTime') : null);
      return start ? start.toISOString() : null;
    })(),
    athleteUserId: athlete && athlete.id ? athlete.id : '',
    athleteApelido: row.get('athleteApelido') || '',
    athleteFullName: row.get('athleteFullName') || '',
    athleteAvatarUrl: row.get('athleteAvatarUrl') || '',
    presidentUserId: president && president.id ? president.id : '',
    presidentApelido: row.get('presidentApelido') || '',
    message: row.get('message') || '',
    declineReason: row.get('declineReason') || '',
    createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : null,
    respondedAt: row.get('respondedAt') ? row.get('respondedAt').toISOString() : null,
  };
}

async function loadTeamMatchSidePresident(event, teamSide) {
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], {
    useMasterKey: true,
  });
  const team = teamSide === 'away' ? event.get('awayTeam') : event.get('homeTeam');
  if (!team || !team.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time do confronto nao encontrado.');
  }
  let president = team.get('president');
  if (president && president.id && typeof president.fetch === 'function') {
    try {
      await president.fetch({ useMasterKey: true });
    } catch {
      /* pointer */
    }
  }
  if (!president || !president.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time sem presidente.');
  }
  return {
    team,
    president,
    teamName: event.get(teamSide === 'away' ? 'awayTeamName' : 'homeTeamName') || team.get('name') || '',
  };
}

Parse.Cloud.define('setTeamMatchAcceptsUninvitedAthletes', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  const accepts = !!request.params.accepts;
  if (!eventId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto e o time (home/away).');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Confronto ja finalizado.');
  }
  const { president } = await loadTeamMatchSidePresident(event, teamSide);
  if (president.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o presidente deste time pode alterar a opcao.'
    );
  }
  const field =
    teamSide === 'away' ? 'awayAcceptsUninvitedAthletes' : 'homeAcceptsUninvitedAthletes';
  event.set(field, accepts);
  await event.save(null, { useMasterKey: true });
  return {
    eventId: event.id,
    homeAcceptsUninvitedAthletes: !!event.get('homeAcceptsUninvitedAthletes'),
    awayAcceptsUninvitedAthletes: !!event.get('awayAcceptsUninvitedAthletes'),
  };
});

Parse.Cloud.define('requestTeamMatchParticipation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  const message = String(request.params.message || '').trim().slice(0, 500);
  if (!eventId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto e o time desejado.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao disponivel apenas para confrontos.');
  }
  if (event.get('isFinished') || new Date() >= event.get('startTime')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel solicitar neste confronto.');
  }

  const acceptsField =
    teamSide === 'away' ? 'awayAcceptsUninvitedAthletes' : 'homeAcceptsUninvitedAthletes';
  if (!event.get(acceptsField)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este time nao esta aceitando atletas nao convocados.'
    );
  }

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (existingReg) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Voce ja esta inscrito neste confronto.');
  }

  const pendingInvite = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', user)
    .equalTo('role', 'athlete')
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (pendingInvite) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Voce ja possui convite de convocacao para este confronto.'
    );
  }

  const duplicate = await new Parse.Query('TeamMatchJoinRequest')
    .equalTo('event', event)
    .equalTo('athlete', user)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Ja existe uma solicitacao pendente.');
  }

  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  if (typeof findUserScheduleConflictDetail === 'function') {
    const conflict = await findUserScheduleConflictDetail(user.id, startTime, endTime, eventId);
    if (conflict.conflict) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `Conflito de agenda com "${conflict.eventName}".`
      );
    }
  }

  const { president, teamName } = await loadTeamMatchSidePresident(event, teamSide);
  if (president.id === user.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Presidente nao solicita participacao no proprio time.');
  }

  try {
    await user.fetch({ useMasterKey: true });
  } catch {
    /* sessao */
  }
  const athleteApelido = String(user.get('apelido') || '').trim();
  const athleteFullName = String(user.get('name') || '').trim();
  const athleteAvatar =
    typeof resolveUserAvatarUrl === 'function' ? resolveUserAvatarUrl(user) : String(user.get('avatarUrl') || '');

  let presidentApelido = '';
  try {
    await president.fetch({ useMasterKey: true });
    presidentApelido = String(president.get('apelido') || president.get('name') || '').trim();
  } catch {
    presidentApelido = '';
  }

  const row = new Parse.Object('TeamMatchJoinRequest');
  row.set('event', event);
  row.set('athlete', user);
  row.set('president', president);
  row.set('teamSide', teamSide);
  row.set('teamName', teamName);
  row.set('eventName', event.get('name') || `${event.get('homeTeamName')} x ${event.get('awayTeamName')}`);
  row.set('eventStartTime', startTime);
  row.set('status', 'pending');
  row.set('message', message);
  row.set('athleteApelido', athleteApelido);
  row.set('athleteFullName', athleteFullName);
  if (athleteAvatar) row.set('athleteAvatarUrl', athleteAvatar);
  row.set('presidentApelido', presidentApelido);
  const acl = new Parse.ACL();
  acl.setReadAccess(user.id, true);
  acl.setWriteAccess(user.id, true);
  acl.setReadAccess(president.id, true);
  acl.setWriteAccess(president.id, true);
  row.setACL(acl);
  await row.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(president.id, {
      title: 'Solicitacao de participacao',
      alert: `${athleteApelido || athleteFullName || 'Um atleta'} pediu para jogar por ${teamName}.`,
      data: {
        type: 'team_match_join_request',
        requestId: row.id,
        eventId: event.id,
      },
    });
  } catch (error) {
    console.error('requestTeamMatchParticipation push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const athleteName = athleteApelido || athleteFullName || 'Um atleta';
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(startTime) : '';
    await createAppMessage({
      recipientId: president.id,
      senderId: user.id,
      kind: 'team_match_join_request',
      title: `Pedido de participacao de ${athleteName}`,
      body:
        `${athleteName} pediu para jogar por ${teamName} em "${row.get('eventName')}"` +
        (dateLabel ? ` (${dateLabel}).` : '.') +
        ' Autorize ou recuse na Entrada.',
      relatedClass: 'TeamMatchJoinRequest',
      relatedId: row.id,
      actionRoute: '/inbox',
    });
  }

  return mapTeamMatchJoinRequestRow(row);
});

Parse.Cloud.define('respondTeamMatchParticipation', async (request) => {
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

  const row = await new Parse.Query('TeamMatchJoinRequest')
    .include('event')
    .include('athlete')
    .include('president')
    .get(requestId, { useMasterKey: true });
  const president = row.get('president');
  if (!president || president.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o presidente do time pode responder.');
  }
  if (row.get('status') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Esta solicitacao ja foi respondida.');
  }

  const event = row.get('event');
  const athlete = row.get('athlete');
  if (!event || !athlete) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao incompleta.');
  }

  if (decision === 'declined') {
    row.set('status', 'declined');
    if (declineReason) row.set('declineReason', declineReason);
    row.set('respondedAt', new Date());
    await row.save(null, { useMasterKey: true });
    try {
      await sendPushToUser(athlete.id, {
        title: 'Participacao recusada',
        alert: `${row.get('teamName') || 'O time'} recusou sua solicitacao no confronto.`,
        data: {
          type: 'team_match_join_response',
          requestId: row.id,
          eventId: event.id,
          decision: 'declined',
        },
      });
    } catch (error) {
      console.error('respondTeamMatchParticipation decline push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      await createAppMessage({
        recipientId: athlete.id,
        senderId: user.id,
        kind: 'team_match_join_response',
        title: 'Participacao recusada',
        body:
          `${row.get('teamName') || 'O time'} recusou sua solicitacao em "${row.get('eventName')}".` +
          (declineReason ? ` Motivo: ${declineReason}.` : ''),
        relatedClass: 'TeamMatchJoinRequest',
        relatedId: row.id,
        actionRoute: `/event/${event.id}`,
      });
    }
    return mapTeamMatchJoinRequestRow(row);
  }

  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  if (typeof findUserScheduleConflictDetail === 'function') {
    const conflict = await findUserScheduleConflictDetail(athlete.id, startTime, endTime, event.id);
    if (conflict.conflict) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `Atleta com conflito de agenda em "${conflict.eventName}".`
      );
    }
  }

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', athlete)
    .first({ useMasterKey: true });
  if (!existingReg) {
    try {
      await athlete.fetch({ useMasterKey: true });
    } catch {
      /* */
    }
    const apelido =
      String(row.get('athleteApelido') || athlete.get('apelido') || athlete.get('name') || '').trim() ||
      athlete.getUsername() ||
      'Atleta';
    const registration = new Parse.Object('EventRegistration');
    registration.set('event', event);
    registration.set('user', athlete);
    registration.set('role', 'athlete');
    registration.set('apelido', apelido);
    registration.set('committed', true);
    registration.set('membershipType', 'convidado');
    registration.set('attendance', 'pending');
    registration.set('paymentConfirmed', true);
    registration.set('paymentExempt', true);
    registration.set('isEffectivelyConfirmed', true);
    registration.set('invitedByContract', true);
    registration.set('contractOfferedAmount', 0);
    registration.set('teamSide', row.get('teamSide'));
    const avatar = row.get('athleteAvatarUrl') || '';
    if (avatar) registration.set('avatarUrl', avatar);
    await registration.save(null, { useMasterKey: true });
  }

  row.set('status', 'accepted');
  row.set('respondedAt', new Date());
  await row.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(athlete.id, {
      title: 'Participacao aceita',
      alert: `${row.get('teamName') || 'O time'} aceitou voce no confronto.`,
      data: {
        type: 'team_match_join_response',
        requestId: row.id,
        eventId: event.id,
        decision: 'accepted',
      },
    });
  } catch (error) {
    console.error('respondTeamMatchParticipation accept push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(startTime) : '';
    await createAppMessage({
      recipientId: athlete.id,
      senderId: user.id,
      kind: 'team_match_join_response',
      title: 'Participacao aceita',
      body:
        `${row.get('teamName') || 'O time'} aceitou voce em "${row.get('eventName')}"` +
        (dateLabel ? ` (${dateLabel}).` : '.'),
      relatedClass: 'TeamMatchJoinRequest',
      relatedId: row.id,
      actionRoute: `/event/${event.id}`,
    });
  }

  return mapTeamMatchJoinRequestRow(row);
});

Parse.Cloud.define('listMyTeamMatchJoinRequests', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const asAthlete = new Parse.Query('TeamMatchJoinRequest').equalTo('athlete', user);
  const asPresident = new Parse.Query('TeamMatchJoinRequest').equalTo('president', user);
  const rows = await Parse.Query.or(asAthlete, asPresident)
    .descending('createdAt')
    .limit(80)
    .find({ useMasterKey: true });
  return rows.map(mapTeamMatchJoinRequestRow);
});

/** Convocacao de atletas no confronto � presidente ou treinador por time */

function normalizeAthleteConvocationBy(value) {
  return value === 'coach' ? 'coach' : 'president';
}

async function resolveCoachManageSidesForTeamMatch(event, user) {
  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', user)
    .equalTo('role', 'coach')
    .containedIn('status', ['pending', 'accepted'])
    .descending('createdAt')
    .first({ useMasterKey: true });
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'coach')
    .first({ useMasterKey: true });

  if (!invitation && !registration) return [];

  const explicit =
    (invitation && invitation.get('teamSide')) ||
    (registration && registration.get('teamSide')) ||
    '';
  if (explicit === 'home' || explicit === 'away') return [explicit];

  const invitedBy =
    (invitation && invitation.get('invitedBy')) ||
    (registration && registration.get('invitedBy')) ||
    null;
  if (!invitedBy || !invitedBy.id) return [];

  const sides = [];
  for (const side of ['home', 'away']) {
    const team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    const president = team && team.get ? team.get('president') : null;
    if (president && president.id === invitedBy.id) sides.push(side);
  }
  return sides;
}

async function resolveTeamMatchConvocationAccess(event, user) {
  const mode = normalizeAthleteConvocationBy(event.get('athleteConvocationBy'));
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], {
    useMasterKey: true,
  });

  const manageSides = [];
  for (const side of ['home', 'away']) {
    const team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    const president = team && team.get ? team.get('president') : null;
    const isPresident = !!(president && president.id === user.id);
    if (isPresident) {
      manageSides.push(side);
      continue;
    }
  }

  if (mode === 'coach') {
    const coachSides = await resolveCoachManageSidesForTeamMatch(event, user);
    for (const side of coachSides) {
      if (!manageSides.includes(side)) manageSides.push(side);
    }
  } else {
    // Modo presidente: apenas presidentes (ja preenchido).
  }

  const admin = event.get('admin');
  const canSetMode = !!(admin && admin.id === user.id);

  return {
    athleteConvocationBy: mode,
    manageSides,
    canManage: manageSides.length > 0,
    canSetMode,
  };
}

Parse.Cloud.define('getTeamMatchConvocationAccess', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  return resolveTeamMatchConvocationAccess(event, user);
});

Parse.Cloud.define('setTeamMatchAthleteConvocationBy', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const value = normalizeAthleteConvocationBy(request.params.athleteConvocationBy);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas quem criou o confronto pode definir quem faz a convocacao.'
    );
  }
  event.set('athleteConvocationBy', value);
  await event.save(null, { useMasterKey: true });
  return { eventId: event.id, athleteConvocationBy: value };
});

Parse.Cloud.define('listTeamMatchConvocations', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  if (!eventId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe evento e time (home/away).');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  const access = await resolveTeamMatchConvocationAccess(event, user);
  if (!access.manageSides.includes(teamSide)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao pode gerenciar a convocacao deste time.'
    );
  }

  const invitations = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .containedIn('status', ['pending', 'accepted'])
    .include('invitedUser')
    .limit(200)
    .find({ useMasterKey: true });

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .include('user')
    .limit(200)
    .find({ useMasterKey: true });

  const byUserId = new Map();
  for (const invitation of invitations) {
    const invited = invitation.get('invitedUser');
    if (!invited || !invited.id) continue;
    byUserId.set(invited.id, {
      userId: invited.id,
      invitationId: invitation.id,
      registrationId: null,
      status: invitation.get('status') || 'pending',
      apelido:
        invitation.get('invitedUserApelido') ||
        (invited.get && (invited.get('apelido') || invited.get('name'))) ||
        'Atleta',
      avatarUrl: invitation.get('invitedUserAvatarUrl') || undefined,
      offeredAmount: Number(invitation.get('offeredAmount') || 0),
      teamSide,
    });
  }
  for (const registration of registrations) {
    const regUser = registration.get('user');
    if (!regUser || !regUser.id) continue;
    const existing = byUserId.get(regUser.id) || {
      userId: regUser.id,
      invitationId: null,
      status: 'accepted',
      apelido: registration.get('apelido') || 'Atleta',
      avatarUrl: registration.get('avatarUrl') || undefined,
      offeredAmount: Number(registration.get('contractOfferedAmount') || 0),
      teamSide,
    };
    existing.registrationId = registration.id;
    existing.status = 'accepted';
    if (!existing.apelido) existing.apelido = registration.get('apelido') || 'Atleta';
    byUserId.set(regUser.id, existing);
  }

  return {
    teamSide,
    teamName:
      teamSide === 'away'
        ? event.get('awayTeamName') || 'Visitante'
        : event.get('homeTeamName') || 'Mandante',
    rows: Array.from(byUserId.values()).sort((a, b) =>
      String(a.apelido).localeCompare(String(b.apelido), 'pt-BR')
    ),
  };
});

Parse.Cloud.define('createTeamMatchAthleteInvitation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const invitedUserId = String(request.params.invitedUserId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  const offeredAmount = Number(request.params.offeredAmount || 0);
  const responseDeadline = request.params.responseDeadline
    ? new Date(request.params.responseDeadline)
    : null;
  if (!eventId || !invitedUserId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe evento, atleta e time (home/away).'
    );
  }
  if (!responseDeadline || Number.isNaN(responseDeadline.getTime()) || responseDeadline <= new Date()) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe um prazo futuro para resposta do convite.'
    );
  }
  if (offeredAmount < 0) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Valor da convocacao invalido.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  const access = await resolveTeamMatchConvocationAccess(event, user);
  if (!access.manageSides.includes(teamSide)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao pode convocar atletas neste time.'
    );
  }

  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  const sameSideExisting = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invitedUser)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (sameSideExisting) {
    throw new Parse.Error(
      Parse.Error.DUPLICATE_VALUE,
      'Este atleta ja possui convocacao ativa neste time para o confronto.'
    );
  }

  const invitation = await createTeamMatchInvitation(
    event,
    invitedUserId,
    user,
    teamSide,
    responseDeadline,
    offeredAmount
  );
  if (!invitation) {
    throw new Parse.Error(
      Parse.Error.DUPLICATE_VALUE,
      'Este atleta ja esta inscrito neste confronto.'
    );
  }

  const invitedUserApelido = String(request.params.invitedUserApelido || '').trim();
  const invitedUserFullName = String(request.params.invitedUserFullName || '').trim();
  const invitedUserAvatarUrl = String(request.params.invitedUserAvatarUrl || '').trim();
  if (invitedUserApelido) invitation.set('invitedUserApelido', invitedUserApelido);
  if (invitedUserFullName) invitation.set('invitedUserFullName', invitedUserFullName);
  if (invitedUserAvatarUrl) invitation.set('invitedUserAvatarUrl', invitedUserAvatarUrl);
  await invitation.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(invitedUserId, {
      title: 'Convocacao para confronto',
      alert:
        (event.get('name') || 'Confronto') +
        ': voce foi convocado. Responda na caixa de entrada.',
      data: {
        type: 'referee_invitation',
        invitationId: invitation.id,
        eventId: event.id,
        role: 'athlete',
      },
    });
  } catch (error) {
    console.error('createTeamMatchAthleteInvitation push failed', error);
  }

  return {
    invitationId: invitation.id,
    status: invitation.get('status') || 'pending',
    teamSide,
  };
});

Parse.Cloud.define('removeTeamMatchAthleteConvocation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const athleteUserId = String(request.params.athleteUserId || '').trim();
  const teamSideParam = String(request.params.teamSide || '').trim();
  if (!eventId || !athleteUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe evento e atleta.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }

  const athlete = Parse.User.createWithoutData(athleteUserId);
  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', athlete)
    .equalTo('role', 'athlete')
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', athlete)
    .first({ useMasterKey: true });

  const teamSide =
    teamSideParam === 'home' || teamSideParam === 'away'
      ? teamSideParam
      : (invitation && invitation.get('teamSide')) ||
        (registration && registration.get('teamSide')) ||
        '';
  if (teamSide !== 'home' && teamSide !== 'away') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao foi possivel identificar o time.');
  }

  const access = await resolveTeamMatchConvocationAccess(event, user);
  if (!access.manageSides.includes(teamSide)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao pode excluir convocacoes deste time.'
    );
  }

  if (invitation) {
    invitation.set('status', 'cancelled');
    invitation.set('cancelledAt', new Date());
    invitation.set('cancelledBy', user);
    invitation.set('cancelReason', 'Removido da convocacao');
    await invitation.save(null, { useMasterKey: true });
  }
  if (registration) {
    await registration.destroy({ useMasterKey: true });
  }
  if (!invitation && !registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Convocacao nao encontrada.');
  }

  const removerName =
    (user.get('apelido') || user.get('name') || user.getUsername() || 'A comissao').trim();
  const teamName =
    teamSide === 'away'
      ? event.get('awayTeamName') || 'Visitante'
      : event.get('homeTeamName') || 'Mandante';

  const removalBody =
    removerName +
    ' removeu voce da convocacao de ' +
    teamName +
    ' no confronto ' +
    (event.get('name') || '') +
    '.';
  try {
    await sendPushToUser(athleteUserId, {
      title: 'Convocacao removida',
      alert: removalBody,
      data: {
        type: 'team_match_convocation_removed',
        eventId: event.id,
        teamSide,
        removedByUserId: user.id,
      },
    });
  } catch (error) {
    console.error('removeTeamMatchAthleteConvocation push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    await createAppMessage({
      recipientId: athleteUserId,
      senderId: user.id,
      kind: 'team_match_convocation_removed',
      title: 'Convocacao removida',
      body: removalBody,
      relatedClass: 'Event',
      relatedId: event.id,
      actionRoute: `/event/${event.id}`,
    });
  }

  return { ok: true, eventId: event.id, athleteUserId, teamSide };
});

Parse.Cloud.define('getTeamMatchGoalkeeperAlerts', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }

  const event = await new Parse.Query('Event')
    .include('homeTeam.president')
    .include('awayTeam.president')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    return { alerts: [] };
  }

  const alertSides = [];
  for (const side of ['home', 'away']) {
    const team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    const president = team && team.get ? team.get('president') : null;
    if (president && president.id === user.id) {
      alertSides.push(side);
    }
  }
  const coachSides = await resolveCoachManageSidesForTeamMatch(event, user);
  for (const side of coachSides) {
    if (!alertSides.includes(side)) alertSides.push(side);
  }
  if (!alertSides.length) {
    return { alerts: [] };
  }

  const participationFee = Number(event.get('participationFee') || 0);
  const isGk =
    typeof isGoalkeeperPosition === 'function'
      ? isGoalkeeperPosition
      : (position) => String(position || '').trim().toLowerCase() === 'goleiro';

  const alerts = [];
  for (const teamSide of alertSides) {
    const invitations = await new Parse.Query('RefereeInvitation')
      .equalTo('event', event)
      .equalTo('role', 'athlete')
      .equalTo('teamSide', teamSide)
      .containedIn('status', ['pending', 'accepted'])
      .include('invitedUser')
      .limit(200)
      .find({ useMasterKey: true });

    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .equalTo('teamSide', teamSide)
      .containedIn('role', ['athlete', 'goalkeeper'])
      .include('user')
      .include('athlete')
      .limit(200)
      .find({ useMasterKey: true });

    const regByUserId = new Map();
    for (const reg of registrations) {
      const uid = reg.get('user') && reg.get('user').id ? String(reg.get('user').id) : '';
      if (uid) regByUserId.set(uid, reg);
    }

    const candidateUserIds = new Set();
    for (const inv of invitations) {
      const iu = inv.get('invitedUser');
      if (iu && iu.id) candidateUserIds.add(String(iu.id));
    }
    for (const uid of regByUserId.keys()) {
      candidateUserIds.add(uid);
    }

    const unconfirmedNames = [];
    for (const userId of candidateUserIds) {
      let position = '';
      const reg = regByUserId.get(userId);
      if (reg) {
        const athlete = reg.get('athlete');
        if (athlete && athlete.get) {
          position = String(athlete.get('primaryPosition') || '');
        }
        if (reg.get('role') === 'goalkeeper') {
          position = position || 'goleiro';
        }
      }
      if (!isGk(position)) {
        try {
          const profile = await new Parse.Query('AthleteProfile')
            .equalTo('user', Parse.User.createWithoutData(userId))
            .first({ useMasterKey: true });
          if (profile) position = String(profile.get('primaryPosition') || '');
        } catch {
          // ignore
        }
      }
      if (!isGk(position)) continue;

      const confirmed =
        reg &&
        typeof computeRegistrationEffectiveConfirmation === 'function'
          ? computeRegistrationEffectiveConfirmation(reg, participationFee)
          : !!(reg && reg.get('isEffectivelyConfirmed'));
      if (confirmed) continue;

      let name = 'Goleiro';
      if (reg) {
        name =
          reg.get('apelido') ||
          reg.get('userDisplayName') ||
          reg.get('userApelido') ||
          name;
      } else {
        try {
          const u = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
          name = u.get('apelido') || u.get('name') || u.getUsername() || name;
        } catch {
          // ignore
        }
      }
      unconfirmedNames.push(String(name));
    }

    if (!unconfirmedNames.length) continue;

    const teamName =
      teamSide === 'away'
        ? event.get('awayTeamName') || 'Visitante'
        : event.get('homeTeamName') || 'Mandante';
    alerts.push({
      teamSide,
      teamName,
      unconfirmedCount: unconfirmedNames.length,
      names: unconfirmedNames,
    });
  }

  return { alerts };
});

function normalizeRefereePaymentMode(value) {
  const v = String(value || '').trim();
  if (v === 'free' || v === 'split_50' || v === 'home_pays') return v;
  return 'free';
}

function refereePaymentModeLabel(mode) {
  if (mode === 'split_50') return '50% para cada presidente';
  if (mode === 'home_pays') return '100% mandante';
  return 'Arbitragem gratuita';
}

async function resolvePresidentUserIdForTeamSide(event, teamSide) {
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], { useMasterKey: true });
  const team = event.get(teamSide === 'away' ? 'awayTeam' : 'homeTeam');
  const president = team && team.get ? team.get('president') : null;
  return president && president.id ? String(president.id) : '';
}

async function assertUserIsPresidentOfTeamSide(event, user, teamSide) {
  const presidentId = await resolvePresidentUserIdForTeamSide(event, teamSide);
  if (!presidentId || presidentId !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o presidente deste time pode enviar esta proposta de arbitragem.'
    );
  }
}

function mapRefereeHiringApprovalRow(invitation) {
  const event = invitation.get('event');
  const invited = invitation.get('invitedUser');
  const invitedBy = invitation.get('invitedBy');
  return {
    invitationId: invitation.id,
    eventId: event && event.id ? event.id : '',
    eventName: event && event.get ? event.get('name') || '' : '',
    eventStartTime:
      event && event.get && event.get('startTime') ? event.get('startTime').toISOString() : null,
    status: invitation.get('status') || 'pending',
    refereeHiringApprovalStatus: invitation.get('refereeHiringApprovalStatus') || '',
    refereeHiringRequestedByTeamSide: invitation.get('refereeHiringRequestedByTeamSide') || '',
    refereePaymentMode: invitation.get('refereePaymentMode') || 'free',
    refereePaymentModeLabel: refereePaymentModeLabel(invitation.get('refereePaymentMode')),
    offeredAmount: Number(invitation.get('offeredAmount') || 0),
    invitedUserId: invited && invited.id ? invited.id : '',
    invitedUserName:
      invitation.get('invitedUserApelido') ||
      invitation.get('invitedUserFullName') ||
      (invited && invited.get
        ? invited.get('apelido') || invited.get('name') || invited.getUsername()
        : '') ||
      'Arbitro',
    invitedById: invitedBy && invitedBy.id ? invitedBy.id : '',
    invitedByName: invitation.get('invitedByName') || 'Presidente',
    responseDeadline:
      invitation.get('responseDeadline') && invitation.get('responseDeadline').toISOString
        ? invitation.get('responseDeadline').toISOString()
        : null,
  };
}

Parse.Cloud.define('createTeamMatchRefereeHiringInvitation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const invitedUserId = String(request.params.invitedUserId || '').trim();
  const requestedByTeamSide =
    request.params.requestedByTeamSide === 'away' ? 'away' : request.params.requestedByTeamSide === 'home' ? 'home' : '';
  const refereePaymentMode = normalizeRefereePaymentMode(request.params.refereePaymentMode);
  const offeredAmount = Number(request.params.offeredAmount ?? 0);
  const responseDeadlineRaw = request.params.responseDeadline;
  const responseDeadline = responseDeadlineRaw ? new Date(responseDeadlineRaw) : null;

  if (!eventId || !invitedUserId || !requestedByTeamSide) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe evento, arbitro e time proponente.');
  }
  if (offeredAmount < 0) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um valor valido.');
  }
  if (!responseDeadline || Number.isNaN(responseDeadline.getTime()) || responseDeadline <= new Date()) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe prazo valido para resposta.');
  }

  const event = await new Parse.Query('Event')
    .include('homeTeam.president')
    .include('awayTeam.president')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Evento ja encerrado.');
  }

  await assertUserIsPresidentOfTeamSide(event, user, requestedByTeamSide);

  const oppositeSide = requestedByTeamSide === 'home' ? 'away' : 'home';
  const approverUserId = await resolvePresidentUserIdForTeamSide(event, oppositeSide);
  if (!approverUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Presidente adversario nao encontrado.');
  }

  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  const duplicate = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invitedUser)
    .equalTo('role', 'referee')
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este arbitro ja possui convite ativo neste confronto.');
  }

  const invitation = new Parse.Object('RefereeInvitation');
  invitation.set('event', event);
  invitation.set('invitedUser', invitedUser);
  invitation.set('invitedBy', user);
  invitation.set('role', 'referee');
  invitation.set('status', 'pending');
  invitation.set('offeredAmount', offeredAmount);
  invitation.set('responseDeadline', responseDeadline);
  invitation.set('refereeHiringRequestedByTeamSide', requestedByTeamSide);
  invitation.set('refereeHiringApprovalStatus', 'pending');
  invitation.set('refereeHiringApproverUserId', approverUserId);
  invitation.set('refereePaymentMode', refereePaymentMode);
  invitation.set('presenceConfirmed', false);
  invitation.set('paymentConfirmedByAdmin', false);
  invitation.set('paymentConfirmedByReferee', false);
  invitation.set('workCompleted', false);
  invitation.set('paymentReleased', false);
  invitation.set('excusedFault', false);

  if (request.params.invitedUserApelido) {
    invitation.set('invitedUserApelido', String(request.params.invitedUserApelido));
  }
  if (request.params.invitedUserFullName) {
    invitation.set('invitedUserFullName', String(request.params.invitedUserFullName));
  }
  if (request.params.invitedUserAvatarUrl) {
    invitation.set('invitedUserAvatarUrl', String(request.params.invitedUserAvatarUrl));
  }

  const inviterApelido = (user.get('apelido') || '').trim();
  const inviterFullName = (user.get('name') || '').trim();
  invitation.set('invitedByName', inviterApelido || inviterFullName || user.getUsername() || 'Presidente');
  if (inviterApelido) invitation.set('invitedByApelido', inviterApelido);
  if (inviterFullName) invitation.set('invitedByFullName', inviterFullName);

  const saved = await invitation.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(approverUserId, {
      title: 'Aprovar arbitragem',
      alert:
        (invitation.get('invitedByName') || 'O outro time') +
        ' propôs contratar um arbitro para o confronto. Toque para aprovar ou recusar.',
      data: {
        type: 'team_match_referee_hiring_approval',
        invitationId: saved.id,
        eventId: event.id,
      },
    });
  } catch (error) {
    console.error('createTeamMatchRefereeHiringInvitation push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const refereeName =
      invitation.get('invitedUserApelido') ||
      invitation.get('invitedUserFullName') ||
      'um arbitro';
    await createAppMessage({
      recipientId: approverUserId,
      senderId: user.id,
      kind: 'team_match_referee_hiring_approval',
      title: 'Aprovar contratacao de arbitro',
      body:
        `${invitation.get('invitedByName') || 'O outro time'} propos contratar ${refereeName} ` +
        `para "${event.get('name') || 'o confronto'}". Pagamento: ` +
        `${refereePaymentModeLabel(refereePaymentMode)}. Aprove ou recuse na Entrada.`,
      relatedClass: 'RefereeInvitation',
      relatedId: saved.id,
      actionRoute: '/inbox',
    });
  }

  return mapRefereeHiringApprovalRow(saved);
});

Parse.Cloud.define('respondTeamMatchRefereeHiringApproval', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const invitationId = String(request.params.invitationId || '').trim();
  const decision = request.params.decision === 'approved' ? 'approved' : 'rejected';
  if (!invitationId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o convite.');
  }

  const invitation = await new Parse.Query('RefereeInvitation')
    .include('event')
    .include('invitedUser')
    .include('invitedBy')
    .get(invitationId, { useMasterKey: true });

  if (invitation.get('role') !== 'referee') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Convite invalido.');
  }
  const approverId = String(invitation.get('refereeHiringApproverUserId') || '');
  if (approverId !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Voce nao pode responder esta aprovacao.');
  }
  if (invitation.get('refereeHiringApprovalStatus') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Esta aprovacao ja foi respondida.');
  }

  invitation.set('refereeHiringApprovalStatus', decision);
  invitation.set('refereeHiringRespondedAt', new Date());

  const event = invitation.get('event');
  const invitedUser = invitation.get('invitedUser');
  const invitedBy = invitation.get('invitedBy');

  if (decision === 'rejected') {
    invitation.set('status', 'declined');
    invitation.set('responseAt', new Date());
    await invitation.save(null, { useMasterKey: true });
    if (invitedBy && invitedBy.id) {
      try {
        await sendPushToUser(invitedBy.id, {
          title: 'Arbitragem recusada',
          alert:
            'O presidente adversario nao concordou com a contratacao do arbitro. Envie uma nova proposta.',
          data: {
            type: 'team_match_referee_hiring_rejected',
            invitationId: invitation.id,
            eventId: event && event.id ? event.id : '',
          },
        });
      } catch (error) {
        console.error('respondTeamMatchRefereeHiringApproval reject push failed', error);
      }

      if (typeof createAppMessage === 'function') {
        await createAppMessage({
          recipientId: invitedBy.id,
          senderId: user.id,
          kind: 'team_match_referee_hiring_rejected',
          title: 'Arbitragem recusada pelo adversario',
          body:
            'O presidente adversario nao concordou com a contratacao do arbitro em ' +
            `"${(event && event.get && event.get('name')) || 'o confronto'}". ` +
            'Envie uma nova proposta no confronto.',
          relatedClass: 'RefereeInvitation',
          relatedId: invitation.id,
          actionRoute: event && event.id ? `/event/${event.id}` : '/inbox',
        });
      }
    }
    return mapRefereeHiringApprovalRow(invitation);
  }

  await invitation.save(null, { useMasterKey: true });

  if (invitedUser && invitedUser.id) {
    try {
      await sendPushToUser(invitedUser.id, {
        title: 'Convite de arbitragem',
        alert:
          'Voce foi convidado para arbitrar um confronto entre times. Toque para ver o convite.',
        data: {
          type: 'hiring_invite',
          invitationId: invitation.id,
          eventId: event && event.id ? event.id : '',
        },
      });
    } catch (error) {
      console.error('respondTeamMatchRefereeHiringApproval approve push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      const dateLabel =
        typeof formatEventPushDate === 'function' && event && event.get
          ? formatEventPushDate(event.get('startTime'))
          : '';
      await createAppMessage({
        recipientId: invitedUser.id,
        senderId: invitedBy && invitedBy.id ? invitedBy.id : '',
        kind: 'hiring_invite',
        title: 'Convite para arbitrar confronto',
        body:
          `Os dois presidentes aprovaram sua arbitragem em "${(event && event.get && event.get('name')) || 'um confronto'}"` +
          (dateLabel ? ` (${dateLabel}).` : '.') +
          ' Aceite ou recuse o convite na Entrada.',
        relatedClass: 'RefereeInvitation',
        relatedId: invitation.id,
        actionRoute: '/inbox',
      });
    }
  }

  return mapRefereeHiringApprovalRow(invitation);
});

Parse.Cloud.define('listTeamMatchRefereeHiringApprovals', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const mailbox = request.params.mailbox === 'out' ? 'out' : 'in';

  if (mailbox === 'in') {
    const rows = await new Parse.Query('RefereeInvitation')
      .equalTo('refereeHiringApproverUserId', user.id)
      .equalTo('refereeHiringApprovalStatus', 'pending')
      .equalTo('role', 'referee')
      .include('event')
      .include('invitedUser')
      .include('invitedBy')
      .descending('createdAt')
      .limit(40)
      .find({ useMasterKey: true });
    return rows.map(mapRefereeHiringApprovalRow);
  }

  const rows = await new Parse.Query('RefereeInvitation')
    .equalTo('invitedBy', user)
    .equalTo('role', 'referee')
    .exists('refereeHiringApprovalStatus')
    .containedIn('refereeHiringApprovalStatus', ['pending', 'rejected'])
    .include('event')
    .include('invitedUser')
    .include('invitedBy')
    .descending('createdAt')
    .limit(40)
    .find({ useMasterKey: true });
  return rows.map(mapRefereeHiringApprovalRow);
});

Parse.Cloud.beforeSave('RefereeInvitation', async (request) => {
  const invitation = request.object;
  if (!invitation || !invitation.id) return;
  if (!invitation.dirty('status')) return;
  const nextStatus = invitation.get('status');
  if (nextStatus !== 'accepted') return;

  const eventPtr = invitation.get('event');
  if (!eventPtr || !eventPtr.id) return;
  let event = eventPtr;
  if (!event.get || !event.get('type')) {
    event = await new Parse.Query('Event').get(eventPtr.id, { useMasterKey: true });
  }
  if (event.get('type') !== 'team_match' || invitation.get('role') !== 'referee') return;

  const approval = invitation.get('refereeHiringApprovalStatus');
  if (approval && approval !== 'approved') {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Este convite de arbitro ainda aguarda aprovacao do presidente adversario.'
    );
  }
});

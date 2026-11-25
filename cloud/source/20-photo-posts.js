/** Postagens de fotos (galeria contextual) — atleta, time, lenda, evento/confronto */

const PHOTO_POST_CLASS = 'PhotoPost';
const PHOTO_CAPTION_MAX = 280;
const PHOTO_SUBJECT_KINDS = new Set([
  'event',
  'athlete_user',
  'amateur_team',
  'legend_athlete',
  'legend_team',
]);

const PHOTO_POST_LIMITS = {
  event: 120,
  athlete_user: 40,
  amateur_team: 30,
  legend_athlete: 10,
  legend_team: 10,
};

function normalizePhotoSubjectKind(value) {
  const kind = String(value || '').trim();
  if (!PHOTO_SUBJECT_KINDS.has(kind)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Tipo de galeria invalido.');
  }
  return kind;
}

function assertPhotoPublicUrl(url, label) {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      `${label} deve ser uma URL publica (http ou https). Envie a foto novamente.`
    );
  }
  return value;
}

function trimPhotoCaption(value) {
  return String(value || '').trim().slice(0, PHOTO_CAPTION_MAX);
}

function personDisplayFromUser(user) {
  if (!user || !user.get) {
    return { name: 'Usuario', avatarUrl: undefined };
  }
  const name =
    user.get('apelido') ||
    user.get('name') ||
    user.getUsername() ||
    'Usuario';
  let avatarUrl = String(user.get('avatarUrl') || '').trim() || undefined;
  const avatar = user.get('avatar');
  if (!avatarUrl && avatar && typeof avatar.url === 'function') {
    avatarUrl = avatar.url();
  }
  return { name, avatarUrl };
}

function mapPhotoPostRow(row) {
  const author = row.get('author');
  const event = row.get('event');
  return {
    objectId: row.id,
    subjectKind: row.get('subjectKind') || '',
    subjectId: row.get('subjectId') || '',
    eventId: event && event.id ? event.id : row.get('eventId') || '',
    imageUrl: row.get('imageUrl') || '',
    caption: row.get('caption') || '',
    authorId: author && author.id ? author.id : '',
    authorName: row.get('authorName') || personDisplayFromUser(author).name,
    authorAvatarUrl: row.get('authorAvatarUrl') || personDisplayFromUser(author).avatarUrl,
    createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : null,
  };
}

async function countPhotoPosts(subjectKind, subjectId) {
  return new Parse.Query(PHOTO_POST_CLASS)
    .equalTo('subjectKind', subjectKind)
    .equalTo('subjectId', subjectId)
    .count({ useMasterKey: true });
}

async function assertEffectivelyConfirmedOnEvent(user, eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (!registration) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Inscricao no evento obrigatoria.');
  }
  const fee = Number(event.get('participationFee') || 0);
  const ok =
    typeof computeRegistrationEffectiveConfirmation === 'function'
      ? computeRegistrationEffectiveConfirmation(registration, fee)
      : !!registration.get('isEffectivelyConfirmed');
  if (!ok) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Participacao ainda nao confirmada.');
  }
  return { event, registration };
}

async function userCanPostPhoto(subjectKind, subjectId, user) {
  if (!user) return false;
  try {
    if (subjectKind === 'event') {
      await assertEffectivelyConfirmedOnEvent(user, subjectId);
      return true;
    }
    if (subjectKind === 'athlete_user') {
      return String(subjectId) === String(user.id);
    }
    if (subjectKind === 'amateur_team') {
      await assertTeamPresident(subjectId, user);
      return true;
    }
    if (subjectKind === 'legend_athlete') {
      const row = await new Parse.Query('AmateurLegendAthlete').get(subjectId, {
        useMasterKey: true,
      });
      assertLegendRegisteredBy(row, user);
      return true;
    }
    if (subjectKind === 'legend_team') {
      const row = await new Parse.Query('AmateurLegendTeam').get(subjectId, {
        useMasterKey: true,
      });
      assertLegendRegisteredBy(row, user);
      return true;
    }
  } catch (error) {
    if (error && error.code === Parse.Error.OPERATION_FORBIDDEN) {
      return false;
    }
    throw error;
  }
  return false;
}

async function assertCanCreatePhotoPost(subjectKind, subjectId, user) {
  const allowed = await userCanPostPhoto(subjectKind, subjectId, user);
  if (!allowed) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem permissao para publicar nesta galeria.');
  }
}

async function assertCanDeletePhotoPost(row, user) {
  const author = row.get('author');
  if (author && author.id === user.id) {
    return;
  }
  const kind = row.get('subjectKind');
  const subjectId = String(row.get('subjectId') || '').trim();
  if (kind === 'amateur_team' && subjectId) {
    await assertTeamPresident(subjectId, user);
    return;
  }
  if (kind === 'legend_athlete' && subjectId) {
    const legend = await new Parse.Query('AmateurLegendAthlete').get(subjectId, {
      useMasterKey: true,
    });
    assertLegendRegisteredBy(legend, user);
    return;
  }
  if (kind === 'legend_team' && subjectId) {
    const legend = await new Parse.Query('AmateurLegendTeam').get(subjectId, {
      useMasterKey: true,
    });
    assertLegendRegisteredBy(legend, user);
    return;
  }
  if (kind === 'event') {
    const authorId = author && author.id ? author.id : '';
    if (authorId === user.id) {
      return;
    }
  }
  throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem permissao para remover esta foto.');
}

Parse.Cloud.define('createPhotoPost', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const subjectKind = normalizePhotoSubjectKind(request.params.subjectKind);
  const subjectId = String(request.params.subjectId || '').trim();
  if (!subjectId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o alvo da galeria.');
  }
  const imageUrl = assertPhotoPublicUrl(request.params.imageUrl, 'Foto');
  let caption = trimPhotoCaption(request.params.caption);
  if (caption && typeof assertCommentDiscipline === 'function') {
    assertCommentDiscipline(caption);
  }

  await assertCanCreatePhotoPost(subjectKind, subjectId, user);

  const limit = PHOTO_POST_LIMITS[subjectKind] || 40;
  const count = await countPhotoPosts(subjectKind, subjectId);
  if (count >= limit) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Limite de ${limit} fotos nesta galeria. Remova uma publicacao antiga.`
    );
  }

  const row = new Parse.Object(PHOTO_POST_CLASS);
  row.set('author', user);
  row.set('subjectKind', subjectKind);
  row.set('subjectId', subjectId);
  row.set('imageUrl', imageUrl);
  row.set('caption', caption);
  const display = personDisplayFromUser(user);
  row.set('authorName', display.name);
  if (display.avatarUrl) {
    row.set('authorAvatarUrl', display.avatarUrl);
  }

  if (subjectKind === 'event') {
    const { event, registration } = await assertEffectivelyConfirmedOnEvent(user, subjectId);
    row.set('event', event);
    row.set('eventId', event.id);
    const regApelido = registration.get('apelido');
    if (regApelido && String(regApelido).trim()) {
      row.set('authorName', String(regApelido).trim());
    }
    const regAvatar = registration.get('avatarUrl');
    if (regAvatar && String(regAvatar).trim()) {
      row.set('authorAvatarUrl', String(regAvatar).trim());
    }
  } else if (request.params.eventId) {
    const eventId = String(request.params.eventId || '').trim();
    if (eventId) {
      row.set('event', Parse.Object.extend('Event').createWithoutData(eventId));
      row.set('eventId', eventId);
    }
  }

  await row.save(null, { useMasterKey: true });
  return { ok: true, post: mapPhotoPostRow(row) };
});

Parse.Cloud.define('listPhotoPosts', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const subjectKind = normalizePhotoSubjectKind(request.params.subjectKind);
  const subjectId = String(request.params.subjectId || '').trim();
  if (!subjectId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o alvo da galeria.');
  }
  const limit = Math.min(Math.max(Number(request.params.limit) || 40, 1), 80);
  const includeEventPhotos =
    subjectKind === 'athlete_user' && request.params.includeEventPhotos === true;

  const posts = [];

  const direct = await new Parse.Query(PHOTO_POST_CLASS)
    .equalTo('subjectKind', subjectKind)
    .equalTo('subjectId', subjectId)
    .descending('createdAt')
    .limit(limit)
    .find({ useMasterKey: true });
  posts.push(...direct.map(mapPhotoPostRow));

  if (includeEventPhotos) {
    const targetUser = Parse.User.createWithoutData(subjectId);
    const regByUser = new Parse.Query('EventRegistration').equalTo('user', targetUser);
    const regByParticipant = new Parse.Query('EventRegistration').equalTo(
      'participantUserId',
      subjectId
    );
    const registrations = await Parse.Query.or(regByUser, regByParticipant)
      .limit(500)
      .find({ useMasterKey: true });
    const eventIds = new Set();
    for (const reg of registrations) {
      const event = reg.get('event');
      if (event && event.id) eventIds.add(event.id);
    }
    if (eventIds.size) {
      const eventPosts = await new Parse.Query(PHOTO_POST_CLASS)
        .equalTo('subjectKind', 'event')
        .containedIn('subjectId', Array.from(eventIds).slice(0, 80))
        .descending('createdAt')
        .limit(40)
        .find({ useMasterKey: true });
      const seen = new Set(posts.map((p) => p.objectId));
      for (const row of eventPosts) {
        const mapped = mapPhotoPostRow(row);
        if (seen.has(mapped.objectId)) continue;
        seen.add(mapped.objectId);
        posts.push(mapped);
      }
      posts.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
    }
  }

  const canPost = await userCanPostPhoto(subjectKind, subjectId, user);
  return {
    ok: true,
    subjectKind,
    subjectId,
    posts: posts.slice(0, limit),
    canPost,
  };
});

Parse.Cloud.define('deletePhotoPost', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const postId = String(request.params.postId || '').trim();
  if (!postId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a foto.');
  }
  const row = await new Parse.Query(PHOTO_POST_CLASS).include('author').get(postId, {
    useMasterKey: true,
  });
  await assertCanDeletePhotoPost(row, user);
  await row.destroy({ useMasterKey: true });
  return { ok: true };
});

Parse.Cloud.define('configurePhotoPostClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const authAddField = { requiresAuthentication: true };
  const cloudOnlyWrite = {
    find: authRead,
    get: authRead,
    count: authRead,
    create: {},
    update: {},
    delete: {},
    addField: authAddField,
    protectedFields: {},
  };

  const created = [];
  const updated = [];
  const schema = new Parse.Schema(PHOTO_POST_CLASS);
  schema.setCLP(cloudOnlyWrite);
  try {
    await schema.update();
    updated.push(PHOTO_POST_CLASS);
  } catch {
    await schema.save();
    created.push(PHOTO_POST_CLASS);
  }

  return { ok: true, classes: 1, created, updated };
});
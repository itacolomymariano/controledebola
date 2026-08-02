/** Imprensa / Midia do evento (radio, jornal e video de melhores momentos) */

const EVENT_MEDIA_SCORE_CATEGORIES = [
  'radio_narration',
  'radio_interview',
  'journal_reportage',
  'journal_interview',
];

const EVENT_MEDIA_ENGAGEMENT_CATEGORIES = [
  ...EVENT_MEDIA_SCORE_CATEGORIES,
  'highlight_video',
];

const EVENT_MEDIA_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
const HIGHLIGHT_VIDEO_MAX_SECONDS = 5 * 60;
const MEDIA_COMMENT_MAX_LENGTH = 280;

const MEDIA_CONTENT_FIELD_BY_CATEGORY = {
  radio_narration: 'radioNarrationTitle',
  radio_interview: 'radioInterviewTitle',
  journal_reportage: 'journalReportageHeadline',
  journal_interview: 'journalInterviewHeadline',
  highlight_video: 'highlightVideoTitle',
};

const MEDIA_VIEW_COUNT_FIELD_BY_CATEGORY = {
  radio_narration: 'radioNarrationViewCount',
  radio_interview: 'radioInterviewViewCount',
  journal_reportage: 'journalReportageViewCount',
  journal_interview: 'journalInterviewViewCount',
  highlight_video: 'highlightVideoViewCount',
};

function normalizeMediaCategory(value, allowHighlight = true) {
  const category = String(value || '').trim();
  const allowed = allowHighlight ? EVENT_MEDIA_ENGAGEMENT_CATEGORIES : EVENT_MEDIA_SCORE_CATEGORIES;
  if (!allowed.includes(category)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Categoria de midia invalida.');
  }
  return category;
}

function normalizeMediaScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Nota deve ser entre 0 e 10.');
  }
  return Math.round(score);
}

function normalizeReaction(value) {
  const reaction = String(value || '').trim().toLowerCase();
  if (!EVENT_MEDIA_REACTIONS.includes(reaction)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Reacao invalida.');
  }
  return reaction;
}

function trimText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

async function loadEventForMedia(eventId) {
  const id = String(eventId || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  return new Parse.Query('Event').include('pelada').get(id, { useMasterKey: true });
}

async function loadUserEventRegistration(user, event) {
  return new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
}

async function assertConfirmedRoleRegistration(user, eventId, role) {
  const event = await loadEventForMedia(eventId);
  const registration = await loadUserEventRegistration(user, event);
  if (!registration) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Inscricao no evento obrigatoria.');
  }
  if (registration.get('role') !== role) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Perfil sem permissao para esta acao.');
  }
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Participacao ainda nao confirmada.');
  }
  return { event, registration };
}

async function getOrCreateEventMediaPublication(event) {
  let row = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!row) {
    // Fallback: algumas linhas antigas podem ter so eventId textual.
    row = await new Parse.Query('EventMediaPublication')
      .equalTo('eventId', event.id)
      .first({ useMasterKey: true });
  }
  if (!row) {
    row = new Parse.Object('EventMediaPublication');
    row.set('event', event);
  } else if (!row.get('event')) {
    row.set('event', event);
  }
  row.set('eventId', event.id);
  const pelada = event.get('pelada');
  if (pelada) {
    row.set('pelada', pelada);
  }
  if (!row.id) {
    await row.save(null, { useMasterKey: true });
  } else if (
    pelada &&
    (!row.get('pelada') || row.get('pelada').id !== pelada.id || !row.get('eventId'))
  ) {
    await row.save(null, { useMasterKey: true });
  }
  return row;
}

function mapAuthorSnapshot(user, registration) {
  return {
    authorId: user.id,
    authorName: (
      registration.get('apelido') ||
      user.get('apelido') ||
      user.get('name') ||
      user.getUsername() ||
      'Autor'
    ).trim(),
    authorApelido: (registration.get('apelido') || user.get('apelido') || '').trim(),
    authorAvatarUrl: resolveStoredAvatarUrl(user, registration) || undefined,
  };
}

function mapMediaAuthorBlock(prefix, publication) {
  return {
    authorId: publication.get(`${prefix}AuthorId`) || '',
    authorName: publication.get(`${prefix}AuthorName`) || '',
    authorApelido: publication.get(`${prefix}AuthorApelido`) || '',
    authorAvatarUrl: publication.get(`${prefix}AuthorAvatarUrl`) || undefined,
    updatedAt: publication.get(`${prefix}UpdatedAt`)
      ? publication.get(`${prefix}UpdatedAt`).toISOString()
      : undefined,
  };
}

async function clearCategoryEngagement(event, category) {
  const views = await new Parse.Query('EventMediaView')
    .equalTo('event', event)
    .equalTo('category', category)
    .limit(1000)
    .find({ useMasterKey: true });
  const reactions = await findReactionsForEventCategory(event, category);
  const comments = await new Parse.Query('EventMediaComment')
    .equalTo('event', event)
    .equalTo('category', category)
    .limit(1000)
    .find({ useMasterKey: true });
  const all = [...views, ...reactions, ...comments];
  if (all.length) {
    await Parse.Object.destroyAll(all, { useMasterKey: true });
  }
}

async function assertPublicationHasCategory(publication, category) {
  const field = MEDIA_CONTENT_FIELD_BY_CATEGORY[category];
  if (!publication || !field || !publication.get(field)) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Conteudo de midia ainda nao publicado.');
  }
}

async function buildMediaVoteSummary(eventId, category) {
  const eventPtr = Parse.Object.extend('Event').createWithoutData(eventId);
  const votes = await new Parse.Query('EventMediaVote')
    .equalTo('event', eventPtr)
    .equalTo('category', category)
    .include('voter')
    .limit(5000)
    .find({ useMasterKey: true });

  const byVoter = new Map();
  for (const vote of votes) {
    const voter = vote.get('voter');
    const voterId = voter && voter.id ? String(voter.id) : vote.id;
    byVoter.set(voterId, Number(vote.get('score') || 0));
  }

  let total = 0;
  for (const score of byVoter.values()) {
    total += score;
  }
  const voteCount = byVoter.size;
  return {
    voteCount,
    averageScore: voteCount > 0 ? Math.round((total / voteCount) * 10) / 10 : 0,
  };
}

function isMediaLevelReaction(row) {
  const raw = row.get('commentId');
  if (raw == null || raw === '') return true;
  const asString = String(raw).trim();
  return !asString || asString === 'undefined' || asString === 'null';
}

function reactionUserId(row) {
  const user = row.get('user');
  return (user && user.id) || row.get('userId') || '';
}

function emptyReactionCounts() {
  const counts = {};
  for (const key of EVENT_MEDIA_REACTIONS) {
    counts[key] = 0;
  }
  return counts;
}

function summarizeReactionRows(rows, userId) {
  const counts = emptyReactionCounts();
  let myReaction = null;
  let total = 0;
  for (const row of rows) {
    const reaction = String(row.get('reaction') || '')
      .trim()
      .toLowerCase();
    if (counts[reaction] == null) continue;
    counts[reaction] += 1;
    total += 1;
    if (userId && reactionUserId(row) === userId) {
      myReaction = reaction;
    }
  }
  return { total, counts, myReaction };
}

/** Une reacoes por pointer event e por eventId textual (dados antigos). */
async function findReactionsForEventCategory(event, category) {
  const byPtr = await new Parse.Query('EventMediaReaction')
    .equalTo('event', event)
    .equalTo('category', category)
    .limit(5000)
    .find({ useMasterKey: true });
  const byId = await new Parse.Query('EventMediaReaction')
    .equalTo('eventId', event.id)
    .equalTo('category', category)
    .limit(5000)
    .find({ useMasterKey: true });
  const map = new Map();
  for (const row of byPtr.concat(byId)) {
    if (row && row.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

/**
 * Reacoes na midia publicada (sem commentId efetivo).
 * Filtra em memoria: doesNotExist falha em linhas antigas com commentId=null.
 */
async function buildReactionSummary(event, category, userId) {
  const rows = await findReactionsForEventCategory(event, category);
  return summarizeReactionRows(rows.filter(isMediaLevelReaction), userId);
}

async function buildCommentReactionSummary(event, category, commentId, userId) {
  const rows = await new Parse.Query('EventMediaReaction')
    .equalTo('event', event)
    .equalTo('category', category)
    .equalTo('commentId', commentId)
    .limit(2000)
    .find({ useMasterKey: true });
  return summarizeReactionRows(rows, userId);
}

async function loadCommentReactionsByCommentId(event, category, commentIds, userId) {
  const byCommentId = {};
  for (const id of commentIds) {
    byCommentId[id] = { total: 0, counts: emptyReactionCounts(), myReaction: null };
  }
  if (!commentIds.length) return byCommentId;

  const rows = await new Parse.Query('EventMediaReaction')
    .equalTo('event', event)
    .equalTo('category', category)
    .containedIn('commentId', commentIds)
    .limit(5000)
    .find({ useMasterKey: true });

  for (const row of rows) {
    const commentId = String(row.get('commentId') || '');
    if (!commentId || !byCommentId[commentId]) continue;
    const reaction = String(row.get('reaction') || '')
      .trim()
      .toLowerCase();
    if (byCommentId[commentId].counts[reaction] == null) continue;
    byCommentId[commentId].counts[reaction] += 1;
    byCommentId[commentId].total += 1;
    if (userId && reactionUserId(row) === userId) {
      byCommentId[commentId].myReaction = reaction;
    }
  }
  return byCommentId;
}

async function loadComments(event, category, userId) {
  const rows = await new Parse.Query('EventMediaComment')
    .equalTo('event', event)
    .equalTo('category', category)
    .ascending('createdAt')
    .limit(500)
    .find({ useMasterKey: true });

  const commentIds = rows.map((row) => row.id).filter(Boolean);
  const reactionsByComment = await loadCommentReactionsByCommentId(
    event,
    category,
    commentIds,
    userId
  );

  const comments = rows.map((row) => {
    const objectId = row.id;
    return {
      objectId,
      userId: row.get('userId') || (row.get('user') && row.get('user').id) || '',
      userName: row.get('userName') || 'Usuario',
      text: row.get('text') || '',
      parentCommentId: row.get('parentCommentId') || null,
      createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : undefined,
      updatedAt: row.get('updatedAt') ? row.get('updatedAt').toISOString() : undefined,
      reactions: reactionsByComment[objectId] || {
        total: 0,
        counts: emptyReactionCounts(),
        myReaction: null,
      },
    };
  });
  return { comments };
}

async function buildEngagementBundle(event, category, userId, publication) {
  const viewCountField = MEDIA_VIEW_COUNT_FIELD_BY_CATEGORY[category];
  const viewCount = Number((publication && publication.get(viewCountField)) || 0);
  let viewedByMe = false;
  if (userId) {
    const existingView = await new Parse.Query('EventMediaView')
      .equalTo('event', event)
      .equalTo('category', category)
      .equalTo('viewer', Parse.User.createWithoutData(userId))
      .first({ useMasterKey: true });
    viewedByMe = !!existingView;
  }
  const reactions = await buildReactionSummary(event, category, userId);
  const { comments } = await loadComments(event, category, userId);
  return {
    viewCount,
    viewedByMe,
    reactions,
    comments,
  };
}

async function loadMyMediaVotes(eventId, userId) {
  const eventPtr = Parse.Object.extend('Event').createWithoutData(eventId);
  const userPtr = Parse.User.createWithoutData(userId);
  const votes = await new Parse.Query('EventMediaVote')
    .equalTo('event', eventPtr)
    .equalTo('voter', userPtr)
    .limit(20)
    .find({ useMasterKey: true });

  const byCategory = {};
  for (const vote of votes) {
    byCategory[vote.get('category')] = Number(vote.get('score') || 0);
  }
  return byCategory;
}

function mapPublicationDashboard(publication, eventId, voteSummaries, myVotes) {
  if (!publication) {
    return {
      eventId,
      radioNarration: null,
      radioInterview: null,
      journalReportage: null,
      journalInterview: null,
      highlightVideo: null,
      myVotes: myVotes || {},
    };
  }

  const radioNarrationTitle = publication.get('radioNarrationTitle');
  const radioInterviewTitle = publication.get('radioInterviewTitle');
  const journalReportageHeadline = publication.get('journalReportageHeadline');
  const journalInterviewHeadline = publication.get('journalInterviewHeadline');
  const highlightVideoTitle = publication.get('highlightVideoTitle');

  return {
    eventId,
    radioNarration: radioNarrationTitle
      ? {
          title: radioNarrationTitle,
          description: publication.get('radioNarrationDescription') || '',
          audioUrl: publication.get('radioNarrationAudioUrl') || '',
          viewCount: Number(publication.get('radioNarrationViewCount') || 0),
          ...mapMediaAuthorBlock('radioNarration', publication),
          votes: voteSummaries.radio_narration,
          myScore: myVotes.radio_narration ?? null,
        }
      : null,
    radioInterview: radioInterviewTitle
      ? {
          title: radioInterviewTitle,
          description: publication.get('radioInterviewDescription') || '',
          audioUrl: publication.get('radioInterviewAudioUrl') || '',
          viewCount: Number(publication.get('radioInterviewViewCount') || 0),
          ...mapMediaAuthorBlock('radioInterview', publication),
          votes: voteSummaries.radio_interview,
          myScore: myVotes.radio_interview ?? null,
        }
      : null,
    journalReportage: journalReportageHeadline
      ? {
          headline: journalReportageHeadline,
          photoUrl: publication.get('journalReportagePhotoUrl') || '',
          body: publication.get('journalReportageBody') || '',
          viewCount: Number(publication.get('journalReportageViewCount') || 0),
          ...mapMediaAuthorBlock('journalReportage', publication),
          votes: voteSummaries.journal_reportage,
          myScore: myVotes.journal_reportage ?? null,
        }
      : null,
    journalInterview: journalInterviewHeadline
      ? {
          headline: journalInterviewHeadline,
          photoUrl: publication.get('journalInterviewPhotoUrl') || '',
          body: publication.get('journalInterviewBody') || '',
          viewCount: Number(publication.get('journalInterviewViewCount') || 0),
          ...mapMediaAuthorBlock('journalInterview', publication),
          votes: voteSummaries.journal_interview,
          myScore: myVotes.journal_interview ?? null,
        }
      : null,
    highlightVideo: highlightVideoTitle
      ? {
          title: highlightVideoTitle,
          description: publication.get('highlightVideoDescription') || '',
          videoUrl: publication.get('highlightVideoUrl') || '',
          durationSec: Number(publication.get('highlightVideoDurationSec') || 0),
          viewCount: Number(publication.get('highlightVideoViewCount') || 0),
          ...mapMediaAuthorBlock('highlightVideo', publication),
        }
      : null,
    myVotes: myVotes || {},
  };
}

function mapTopMediaItem(publication, kind) {
  if (!publication) return null;
  const event = publication.get('event');
  const pelada = publication.get('pelada');
  const base = {
    eventId: event && event.id ? event.id : '',
    eventName: (event && event.get && event.get('name')) || '',
    peladaId: pelada && pelada.id ? pelada.id : '',
    peladaName: (pelada && pelada.get && pelada.get('name')) || '',
    publicationId: publication.id,
  };

  if (kind === 'video') {
    const title = publication.get('highlightVideoTitle');
    if (!title) return null;
    return {
      ...base,
      kind: 'video',
      category: 'highlight_video',
      title,
      description: publication.get('highlightVideoDescription') || '',
      mediaUrl: publication.get('highlightVideoUrl') || '',
      viewCount: Number(publication.get('highlightVideoViewCount') || 0),
      authorName: publication.get('highlightVideoAuthorName') || '',
      authorApelido: publication.get('highlightVideoAuthorApelido') || '',
      authorAvatarUrl: publication.get('highlightVideoAuthorAvatarUrl') || undefined,
      updatedAt: publication.get('highlightVideoUpdatedAt')
        ? publication.get('highlightVideoUpdatedAt').toISOString()
        : undefined,
    };
  }

  if (kind === 'radio') {
    const narrationViews = Number(publication.get('radioNarrationViewCount') || 0);
    const interviewViews = Number(publication.get('radioInterviewViewCount') || 0);
    const useInterview = interviewViews > narrationViews && publication.get('radioInterviewTitle');
    if (useInterview) {
      return {
        ...base,
        kind: 'radio',
        category: 'radio_interview',
        title: publication.get('radioInterviewTitle') || '',
        description: publication.get('radioInterviewDescription') || '',
        mediaUrl: publication.get('radioInterviewAudioUrl') || '',
        viewCount: interviewViews,
        authorName: publication.get('radioInterviewAuthorName') || '',
        authorApelido: publication.get('radioInterviewAuthorApelido') || '',
        authorAvatarUrl: publication.get('radioInterviewAuthorAvatarUrl') || undefined,
        updatedAt: publication.get('radioInterviewUpdatedAt')
          ? publication.get('radioInterviewUpdatedAt').toISOString()
          : undefined,
      };
    }
    if (!publication.get('radioNarrationTitle')) return null;
    return {
      ...base,
      kind: 'radio',
      category: 'radio_narration',
      title: publication.get('radioNarrationTitle') || '',
      description: publication.get('radioNarrationDescription') || '',
      mediaUrl: publication.get('radioNarrationAudioUrl') || '',
      viewCount: narrationViews,
      authorName: publication.get('radioNarrationAuthorName') || '',
      authorApelido: publication.get('radioNarrationAuthorApelido') || '',
      authorAvatarUrl: publication.get('radioNarrationAuthorAvatarUrl') || undefined,
      updatedAt: publication.get('radioNarrationUpdatedAt')
        ? publication.get('radioNarrationUpdatedAt').toISOString()
        : undefined,
    };
  }

  // journal
  const reportageViews = Number(publication.get('journalReportageViewCount') || 0);
  const interviewViews = Number(publication.get('journalInterviewViewCount') || 0);
  const useInterview = interviewViews > reportageViews && publication.get('journalInterviewHeadline');
  if (useInterview) {
    return {
      ...base,
      kind: 'journal',
      category: 'journal_interview',
      title: publication.get('journalInterviewHeadline') || '',
      description: publication.get('journalInterviewBody') || '',
      mediaUrl: publication.get('journalInterviewPhotoUrl') || '',
      viewCount: interviewViews,
      authorName: publication.get('journalInterviewAuthorName') || '',
      authorApelido: publication.get('journalInterviewAuthorApelido') || '',
      authorAvatarUrl: publication.get('journalInterviewAuthorAvatarUrl') || undefined,
      updatedAt: publication.get('journalInterviewUpdatedAt')
        ? publication.get('journalInterviewUpdatedAt').toISOString()
        : undefined,
    };
  }
  if (!publication.get('journalReportageHeadline')) return null;
  return {
    ...base,
    kind: 'journal',
    category: 'journal_reportage',
    title: publication.get('journalReportageHeadline') || '',
    description: publication.get('journalReportageBody') || '',
    mediaUrl: publication.get('journalReportagePhotoUrl') || '',
    viewCount: reportageViews,
    authorName: publication.get('journalReportageAuthorName') || '',
    authorApelido: publication.get('journalReportageAuthorApelido') || '',
    authorAvatarUrl: publication.get('journalReportageAuthorAvatarUrl') || undefined,
    updatedAt: publication.get('journalReportageUpdatedAt')
      ? publication.get('journalReportageUpdatedAt').toISOString()
      : undefined,
  };
}

Parse.Cloud.define('getEventMediaDashboard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const event = await loadEventForMedia(eventId);

  let publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!publication) {
    publication = await new Parse.Query('EventMediaPublication')
      .equalTo('eventId', eventId)
      .first({ useMasterKey: true });
  }

  const voteSummaries = {};
  for (const category of EVENT_MEDIA_SCORE_CATEGORIES) {
    try {
      voteSummaries[category] = await buildMediaVoteSummary(eventId, category);
    } catch (error) {
      console.error('buildMediaVoteSummary failed', category, error);
      voteSummaries[category] = { voteCount: 0, averageScore: 0 };
    }
  }
  let myVotes = {};
  try {
    myVotes = await loadMyMediaVotes(eventId, user.id);
  } catch (error) {
    console.error('loadMyMediaVotes failed', error);
  }

  return mapPublicationDashboard(publication, eventId, voteSummaries, myVotes);
});

Parse.Cloud.define('publishEventRadioNarration', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = trimText(request.params.title, 120);
  const description = trimText(request.params.description, 500);
  const audioUrl = trimText(request.params.audioUrl, 2048);
  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o titulo da narracao.');
  }
  if (!description) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe uma breve descricao da narracao.');
  }
  if (!audioUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Audio da narracao obrigatorio.');
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'narrator');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('radioNarrationTitle');

  publication.set('radioNarrationTitle', title);
  publication.set('radioNarrationDescription', description);
  publication.set('radioNarrationAudioUrl', audioUrl);
  publication.set('radioNarrationAuthorId', author.authorId);
  publication.set('radioNarrationAuthorName', author.authorName);
  publication.set('radioNarrationAuthorApelido', author.authorApelido);
  publication.set('radioNarrationAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('radioNarrationUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'radio_narration');
  }
  publication.set('radioNarrationViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventRadioInterview', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = trimText(request.params.title, 120);
  const description = trimText(request.params.description, 500);
  const audioUrl = trimText(request.params.audioUrl, 2048);
  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o titulo da entrevista.');
  }
  if (!description) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe uma breve descricao da entrevista.');
  }
  if (!audioUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Audio da entrevista obrigatorio.');
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'narrator');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('radioInterviewTitle');

  publication.set('radioInterviewTitle', title);
  publication.set('radioInterviewDescription', description);
  publication.set('radioInterviewAudioUrl', audioUrl);
  publication.set('radioInterviewAuthorId', author.authorId);
  publication.set('radioInterviewAuthorName', author.authorName);
  publication.set('radioInterviewAuthorApelido', author.authorApelido);
  publication.set('radioInterviewAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('radioInterviewUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'radio_interview');
  }
  publication.set('radioInterviewViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventJournalReportage', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const headline = trimText(request.params.headline, 160);
  const body = trimText(request.params.body, 12000);
  const photoUrl = trimText(request.params.photoUrl, 2048);
  if (!headline) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe a manchete da reportagem.');
  }
  if (!body) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o texto da reportagem.');
  }
  if (!photoUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Foto da reportagem obrigatoria.');
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'journalist');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('journalReportageHeadline');

  publication.set('journalReportageHeadline', headline);
  publication.set('journalReportageBody', body);
  publication.set('journalReportagePhotoUrl', photoUrl);
  publication.set('journalReportageAuthorId', author.authorId);
  publication.set('journalReportageAuthorName', author.authorName);
  publication.set('journalReportageAuthorApelido', author.authorApelido);
  publication.set('journalReportageAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('journalReportageUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'journal_reportage');
  }
  publication.set('journalReportageViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventJournalInterview', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const headline = trimText(request.params.headline, 160);
  const body = trimText(request.params.body, 12000);
  const photoUrl = trimText(request.params.photoUrl, 2048);
  if (!headline) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe a manchete da entrevista.');
  }
  if (!body) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o texto da entrevista.');
  }
  if (!photoUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Foto da entrevista obrigatoria.');
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'journalist');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('journalInterviewHeadline');

  publication.set('journalInterviewHeadline', headline);
  publication.set('journalInterviewBody', body);
  publication.set('journalInterviewPhotoUrl', photoUrl);
  publication.set('journalInterviewAuthorId', author.authorId);
  publication.set('journalInterviewAuthorName', author.authorName);
  publication.set('journalInterviewAuthorApelido', author.authorApelido);
  publication.set('journalInterviewAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('journalInterviewUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'journal_interview');
  }
  publication.set('journalInterviewViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventHighlightVideo', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = trimText(request.params.title, 120);
  const description = trimText(request.params.description, 500);
  const videoUrl = trimText(request.params.videoUrl, 2048);
  const durationSec = Math.round(Number(request.params.durationSec || 0));

  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o titulo do video.');
  }
  if (!description) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe uma breve descricao do video.');
  }
  if (!videoUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Video obrigatorio.');
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Duracao do video invalida.');
  }
  if (durationSec > HIGHLIGHT_VIDEO_MAX_SECONDS) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'O video de melhores momentos deve ter no maximo 5 minutos.'
    );
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'cameraman');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('highlightVideoTitle');

  publication.set('highlightVideoTitle', title);
  publication.set('highlightVideoDescription', description);
  publication.set('highlightVideoUrl', videoUrl);
  publication.set('highlightVideoDurationSec', durationSec);
  publication.set('highlightVideoAuthorId', author.authorId);
  publication.set('highlightVideoAuthorName', author.authorName);
  publication.set('highlightVideoAuthorApelido', author.authorApelido);
  publication.set('highlightVideoAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('highlightVideoUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'highlight_video');
  }
  publication.set('highlightVideoViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString(), overwritten: hadContent };
});

Parse.Cloud.define('castEventMediaVote', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, false);
  const clearRequested = !!request.params.clear;
  const event = await loadEventForMedia(eventId);

  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  const existing = await new Parse.Query('EventMediaVote')
    .equalTo('event', event)
    .equalTo('category', category)
    .equalTo('voter', user)
    .first({ useMasterKey: true });

  // Toggle: clear explicito ou clicar na mesma nota remove o voto (permite escolher outra).
  if (existing) {
    const currentScore = Number(existing.get('score'));
    const score = clearRequested ? currentScore : normalizeMediaScore(request.params.score);
    if (clearRequested || currentScore === score) {
      await existing.destroy({ useMasterKey: true });
      const summary = await buildMediaVoteSummary(eventId, category);
      return { ok: true, score: null, myScore: null, ...summary };
    }
    existing.set('score', score);
    await existing.save(null, { useMasterKey: true });
    const summary = await buildMediaVoteSummary(eventId, category);
    return { ok: true, score, myScore: score, ...summary };
  }

  if (clearRequested) {
    const summary = await buildMediaVoteSummary(eventId, category);
    return { ok: true, score: null, myScore: null, ...summary };
  }

  const score = normalizeMediaScore(request.params.score);
  const vote = new Parse.Object('EventMediaVote');
  vote.set('event', event);
  vote.set('category', category);
  vote.set('voter', user);
  vote.set('score', score);
  await vote.save(null, { useMasterKey: true });

  const summary = await buildMediaVoteSummary(eventId, category);
  return { ok: true, score, myScore: score, ...summary };
});

Parse.Cloud.define('getEventMediaEngagement', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  return {
    ok: true,
    eventId,
    category,
    ...(await buildEngagementBundle(event, category, user.id, publication)),
  };
});

Parse.Cloud.define('recordEventMediaView', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  const existing = await new Parse.Query('EventMediaView')
    .equalTo('event', event)
    .equalTo('category', category)
    .equalTo('viewer', user)
    .first({ useMasterKey: true });

  const viewCountField = MEDIA_VIEW_COUNT_FIELD_BY_CATEGORY[category];
  let viewCount = Number(publication.get(viewCountField) || 0);
  let counted = false;
  const authorId = getMediaPublicationAuthorId(publication, category);
  const isAuthor = !!(authorId && authorId === user.id);
  const confirmed = await isConfirmedEventParticipant(user, event);
  const countsForTop = !isAuthor && confirmed;

  if (!existing) {
    const view = new Parse.Object('EventMediaView');
    view.set('event', event);
    view.set('eventId', event.id);
    view.set('category', category);
    view.set('viewer', user);
    view.set('viewerId', user.id);
    view.set('countsForTop', countsForTop);
    const pelada = event.get('pelada');
    if (pelada) view.set('pelada', pelada);
    await view.save(null, { useMasterKey: true });

    if (countsForTop) {
      viewCount += 1;
      publication.set(viewCountField, viewCount);
      await publication.save(null, { useMasterKey: true });
      counted = true;
    }
  }

  return {
    ok: true,
    counted,
    viewCount,
    viewedByMe: true,
    countsForTop,
    skippedReason: existing
      ? 'already_viewed'
      : isAuthor
        ? 'author'
        : !confirmed
          ? 'not_confirmed_participant'
          : null,
  };
});

Parse.Cloud.define('setEventMediaReaction', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const clear = !!request.params.clear;
  const commentId = String(request.params.commentId || '').trim();
  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  if (!commentId && !clear) {
    assertNotMediaAuthorEngagement(publication, category, user.id, 'reagir');
  }

  if (commentId) {
    const comment = await new Parse.Query('EventMediaComment').get(commentId, { useMasterKey: true });
    const commentEvent = comment.get('event');
    if (!commentEvent || commentEvent.id !== event.id || comment.get('category') !== category) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Comentario invalido para esta midia.');
    }
  }

  const candidates = await findReactionsForEventCategory(event, category);
  const existing =
    candidates.find((row) => {
      if (reactionUserId(row) !== user.id) return false;
      if (commentId) return String(row.get('commentId') || '') === commentId;
      return isMediaLevelReaction(row);
    }) || null;

  if (clear) {
    if (existing) {
      await existing.destroy({ useMasterKey: true });
    }
  } else {
    const reaction = normalizeReaction(request.params.reaction);
    if (existing) {
      existing.set('reaction', reaction);
      existing.set('event', event);
      existing.set('eventId', event.id);
      existing.set('user', user);
      existing.set('userId', user.id);
      if (commentId) {
        existing.set('commentId', commentId);
      } else if (existing.get('commentId') != null) {
        existing.unset('commentId');
      }
      await existing.save(null, { useMasterKey: true });
    } else {
      const row = new Parse.Object('EventMediaReaction');
      row.set('event', event);
      row.set('eventId', event.id);
      row.set('category', category);
      row.set('user', user);
      row.set('userId', user.id);
      row.set('reaction', reaction);
      if (commentId) {
        row.set('commentId', commentId);
      }
      await row.save(null, { useMasterKey: true });
    }
  }

  if (commentId) {
    return {
      ok: true,
      commentId,
      ...(await buildCommentReactionSummary(event, category, commentId, user.id)),
    };
  }

  return {
    ok: true,
    ...(await buildReactionSummary(event, category, user.id)),
  };
});

Parse.Cloud.define('upsertEventMediaComment', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const text = trimText(request.params.text, MEDIA_COMMENT_MAX_LENGTH);
  if (!text) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe um comentario breve.');
  }
  assertCommentDiscipline(text);

  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);
  assertNotMediaAuthorEngagement(publication, category, user.id, 'comentar');

  let parentCommentId = String(request.params.parentCommentId || '').trim();
  if (parentCommentId) {
    const parent = await new Parse.Query('EventMediaComment').get(parentCommentId, {
      useMasterKey: true,
    });
    const parentEvent = parent.get('event');
    if (!parentEvent || parentEvent.id !== event.id || parent.get('category') !== category) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Comentario pai invalido.');
    }
    // Um nivel de resposta: respostas aninhadas ficam sob o comentario raiz.
    const rootParentId = String(parent.get('parentCommentId') || '').trim();
    if (rootParentId) {
      parentCommentId = rootParentId;
    }
  }

  const userName = (user.get('apelido') || user.get('name') || user.getUsername() || 'Usuario').trim();
  const row = new Parse.Object('EventMediaComment');
  row.set('event', event);
  row.set('category', category);
  row.set('user', user);
  row.set('userId', user.id);
  row.set('userName', userName);
  row.set('text', text);
  if (parentCommentId) {
    row.set('parentCommentId', parentCommentId);
  }
  await row.save(null, { useMasterKey: true });

  const { comments } = await loadComments(event, category, user.id);
  return { ok: true, comments };
});

Parse.Cloud.define('getTopEventMedia', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const kind = String(request.params.kind || 'video').trim();
  if (!['video', 'radio', 'journal'].includes(kind)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'kind invalido (video|radio|journal).');
  }
  const scope = String(request.params.scope || 'app').trim();
  if (!['app', 'pelada'].includes(scope)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'scope invalido (app|pelada).');
  }

  const peladaId = scope === 'pelada' ? String(request.params.peladaId || '').trim() : '';
  if (scope === 'pelada' && !peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio para scope pelada.');
  }
  const peladaPtr = peladaId
    ? Parse.Object.extend('Pelada').createWithoutData(peladaId)
    : null;

  function applyScope(q) {
    if (peladaPtr) q.equalTo('pelada', peladaPtr);
    q.include(['event', 'pelada']);
    q.limit(200);
    return q;
  }

  let rows = [];
  if (kind === 'video') {
    const query = applyScope(new Parse.Query('EventMediaPublication'));
    query.exists('highlightVideoUrl');
    query.descending('highlightVideoViewCount');
    rows = await query.find({ useMasterKey: true });
  } else if (kind === 'radio') {
    const qNarration = applyScope(new Parse.Query('EventMediaPublication'));
    qNarration.exists('radioNarrationTitle');
    qNarration.descending('radioNarrationViewCount');
    const qInterview = applyScope(new Parse.Query('EventMediaPublication'));
    qInterview.exists('radioInterviewTitle');
    qInterview.descending('radioInterviewViewCount');
    const [narrationRows, interviewRows] = await Promise.all([
      qNarration.find({ useMasterKey: true }),
      qInterview.find({ useMasterKey: true }),
    ]);
    const map = new Map();
    for (const row of narrationRows.concat(interviewRows)) {
      if (row && row.id) map.set(row.id, row);
    }
    rows = Array.from(map.values());
  } else {
    const qReportage = applyScope(new Parse.Query('EventMediaPublication'));
    qReportage.exists('journalReportageHeadline');
    qReportage.descending('journalReportageViewCount');
    const qInterview = applyScope(new Parse.Query('EventMediaPublication'));
    qInterview.exists('journalInterviewHeadline');
    qInterview.descending('journalInterviewViewCount');
    const [reportageRows, interviewRows] = await Promise.all([
      qReportage.find({ useMasterKey: true }),
      qInterview.find({ useMasterKey: true }),
    ]);
    const map = new Map();
    for (const row of reportageRows.concat(interviewRows)) {
      if (row && row.id) map.set(row.id, row);
    }
    rows = Array.from(map.values());
  }

  let best = null;
  for (const row of rows) {
    const mapped = mapTopMediaItem(row, kind);
    if (!mapped) continue;
    if (!meetsMediaTopViewQuorum(mapped.viewCount)) continue;
    if (!best || mapped.viewCount > best.viewCount) {
      best = mapped;
    }
  }

  return { ok: true, scope, kind, item: best, minViews: INTEGRITY_MIN_MEDIA_TOP_VIEWS };
});

Parse.Cloud.define('configureEventMediaClassPermissions', async (request) => {
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

  // Publicacao ainda precisa de update via Cloud (Master Key); cliente nao cria/edita direto.
  const created = [];
  const updated = [];
  for (const className of [
    'EventMediaPublication',
    'EventMediaVote',
    'EventMediaView',
    'EventMediaReaction',
    'EventMediaComment',
  ]) {
    const schema = new Parse.Schema(className);
    schema.setCLP(cloudOnlyWrite);
    try {
      await schema.update();
      updated.push(className);
    } catch {
      await schema.save();
      created.push(className);
    }
  }

  return { ok: true, classes: 5, created, updated };
});
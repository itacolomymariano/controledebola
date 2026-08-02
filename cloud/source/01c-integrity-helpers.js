/** Integridade / anti-manipulacao — regras transparentes (mural + midia). */

const INTEGRITY_MIN_EVENT_VOTERS = 3;
const INTEGRITY_MIN_MEDIA_TOP_VIEWS = 3;
const INTEGRITY_MIN_LOCATION_ROLE_VOTES = 3;

const MEDIA_AUTHOR_ID_FIELD_BY_CATEGORY = {
  radio_narration: 'radioNarrationAuthorId',
  radio_interview: 'radioInterviewAuthorId',
  journal_reportage: 'journalReportageAuthorId',
  journal_interview: 'journalInterviewAuthorId',
  highlight_video: 'highlightVideoAuthorId',
};

function assertNotSelfMuralVote(voterId, targetUserId) {
  const voter = String(voterId || '').trim();
  const target = String(targetUserId || '').trim();
  if (voter && target && voter === target) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Nao e permitido votar em si mesmo.'
    );
  }
}

function getMediaPublicationAuthorId(publication, category) {
  if (!publication) return '';
  const field = MEDIA_AUTHOR_ID_FIELD_BY_CATEGORY[category];
  if (!field) return '';
  return String(publication.get(field) || '').trim();
}

function assertNotMediaAuthorEngagement(publication, category, userId, actionLabel) {
  const authorId = getMediaPublicationAuthorId(publication, category);
  const uid = String(userId || '').trim();
  if (authorId && uid && authorId === uid) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      `O autor nao pode ${actionLabel} na propria publicacao.`
    );
  }
}

async function loadConfirmedEventRegistration(user, event) {
  if (!user || !event) return null;
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (!registration) return null;
  const participationFee = Number(event.get('participationFee') || 0);
  if (typeof computeRegistrationEffectiveConfirmation !== 'function') {
    return registration.get('isEffectivelyConfirmed') ? registration : null;
  }
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    return null;
  }
  return registration;
}

async function isConfirmedEventParticipant(user, event) {
  return !!(await loadConfirmedEventRegistration(user, event));
}

function meetsEventVoterQuorum(voterCount) {
  return Number(voterCount) >= INTEGRITY_MIN_EVENT_VOTERS;
}

function meetsMediaTopViewQuorum(viewCount) {
  return Number(viewCount) >= INTEGRITY_MIN_MEDIA_TOP_VIEWS;
}

function emptyMuralRoleRankings() {
  const roles =
    typeof MURAL_TARGET_ROLES !== 'undefined' && Array.isArray(MURAL_TARGET_ROLES)
      ? MURAL_TARGET_ROLES
      : [
          'athlete',
          'goalkeeper',
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
        ];
  const result = {};
  for (const role of roles) {
    result[role] = [];
  }
  return result;
}

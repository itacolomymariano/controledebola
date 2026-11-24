/** Reputacao de bom uso do app (perfil vs. rankings do mural — ex. altura extrema sem idade). */

const APP_USAGE_REPUTATION_DEFAULT = 1;
/** Abaixo disto o atleta nao entra em destaques de altura no Explorar. */
const APP_USAGE_REPUTATION_HEIGHT_SHOWCASE_MIN = 0.6;
/** Altura muito baixa sem data de nascimento: suspeita de aparecer no mural como "mais baixo". */
const MURAL_SHORTEST_GAMING_MAX_HEIGHT_CM = 140;
const APP_USAGE_REPUTATION_GAMING_SCORE = 0.45;

function userHasShareableAge(user) {
  if (!user) return false;
  const birthDate = user.get('birthDate');
  return birthDate instanceof Date && !Number.isNaN(birthDate.getTime());
}

/**
 * @param {Parse.User|object} user
 * @param {number} heightCm altura no AthleteProfile
 */
function isSuspectedMuralShortestGaming(user, heightCm) {
  const height = Number(heightCm || 0);
  if (height <= 0 || height > MURAL_SHORTEST_GAMING_MAX_HEIGHT_CM) return false;
  return !userHasShareableAge(user);
}

function computeAppUsageReputationScore(user, heightCm) {
  if (isSuspectedMuralShortestGaming(user, heightCm)) {
    return APP_USAGE_REPUTATION_GAMING_SCORE;
  }
  return APP_USAGE_REPUTATION_DEFAULT;
}

function muralHeightShowcaseAllowedForUser(user) {
  if (!user) return true;
  if (user.get('muralHeightGamingSuspected')) return false;
  const rep = Number(user.get('appUsageReputation'));
  if (!Number.isNaN(rep) && rep > 0 && rep < APP_USAGE_REPUTATION_HEIGHT_SHOWCASE_MIN) {
    return false;
  }
  return true;
}

async function refreshUserAppUsageReputationForUserId(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return;

  let user;
  try {
    user = await new Parse.Query(Parse.User).get(uid, { useMasterKey: true });
  } catch {
    return;
  }

  const athleteProfile = await new Parse.Query('AthleteProfile')
    .equalTo('user', user)
    .first({ useMasterKey: true });

  const heightCm = athleteProfile ? Number(athleteProfile.get('height') || 0) : 0;
  const gaming = isSuspectedMuralShortestGaming(user, heightCm);
  const nextScore = computeAppUsageReputationScore(user, heightCm);

  const prevScore = Number(user.get('appUsageReputation'));
  const prevGaming = !!user.get('muralHeightGamingSuspected');

  if (
    !Number.isNaN(prevScore) &&
    Math.abs(prevScore - nextScore) < 0.001 &&
    prevGaming === gaming
  ) {
    return;
  }

  user.set('appUsageReputation', nextScore);
  user.set('muralHeightGamingSuspected', gaming);
  if (gaming) {
    user.set('muralHeightGamingAt', new Date());
  } else {
    user.unset('muralHeightGamingAt');
  }
  await user.save(null, { useMasterKey: true });
}

Parse.Cloud.afterSave('AthleteProfile', async (request) => {
  const profile = request.object;
  if (!profile) return;
  const user = profile.get('user');
  const userId = user && (user.id || user.objectId);
  if (userId) await refreshUserAppUsageReputationForUserId(userId);
});

Parse.Cloud.afterSave(Parse.User, async (request) => {
  const user = request.object;
  if (!user || !user.id) return;
  const orig = request.original;
  const origDate = orig ? orig.get('birthDate') : undefined;
  const nextDate = user.get('birthDate');
  const origTime = origDate instanceof Date ? origDate.getTime() : 0;
  const nextTime = nextDate instanceof Date ? nextDate.getTime() : 0;
  if (origTime === nextTime) return;
  await refreshUserAppUsageReputationForUserId(user.id);
});
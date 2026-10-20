/** Confiabilidade do avaliador (mural) — peso 0..1 por historico de notas. */

const VOTER_RELIABILITY_MIN_SCORES = 4;
const VOTER_RELIABILITY_TARGET_MEAN = 7.5;

/**
 * @param {number[]} scores notas 0–10 dadas pelo mesmo votante (deduplicadas)
 * @returns {number} multiplicador de peso (min 0.35, max 1)
 */
function computeVoterReliabilityScore(scores) {
  const list = (scores || []).map((value) => Number(value)).filter((value) => !Number.isNaN(value));
  if (list.length < VOTER_RELIABILITY_MIN_SCORES) return 1;

  const mean = list.reduce((sum, value) => sum + value, 0) / list.length;
  const variance = list.reduce((sum, value) => sum + (value - mean) ** 2, 0) / list.length;
  const std = Math.sqrt(variance);

  const differentiation = Math.min(1, std / 2.2);
  const extremismPenalty = Math.min(1, Math.abs(mean - VOTER_RELIABILITY_TARGET_MEAN) / 2.5);
  const moderation = 1 - extremismPenalty * 0.5;

  const raw = 0.35 + 0.4 * differentiation + 0.25 * moderation;
  return Math.max(0.35, Math.min(1, raw));
}

/**
 * Ajusta scoreWeight / weightedScore com confiabilidade por voterId (in-place).
 * @param {Array<{ voterId?: string, score?: number, scoreWeight?: number, weightedScore?: number }>} voteRows
 */
function attachVoterReliabilityWeightsFromRows(voteRows) {
  if (!Array.isArray(voteRows) || !voteRows.length) return voteRows;

  const scoresByVoter = new Map();
  for (const vote of voteRows) {
    const voterId = vote.voterId ? String(vote.voterId) : '';
    if (!voterId) continue;
    const list = scoresByVoter.get(voterId) || [];
    list.push(Number(vote.score || 0));
    scoresByVoter.set(voterId, list);
  }

  const reliabilityByVoter = new Map();
  for (const [voterId, scores] of scoresByVoter) {
    reliabilityByVoter.set(voterId, computeVoterReliabilityScore(scores));
  }

  for (const vote of voteRows) {
    const voterId = vote.voterId ? String(vote.voterId) : '';
    if (!voterId) continue;
    const reliability = reliabilityByVoter.get(voterId) ?? 1;
    const eventWeight = Number(vote.scoreWeight || 1) || 1;
    vote.voterReliability = reliability;
    vote.scoreWeight = eventWeight * reliability;
    vote.weightedScore = Number(vote.score || 0) * vote.scoreWeight;
  }

  return voteRows;
}

/**
 * Authority comparator for Global Optimizer candidates.
 *
 * Reuses private-pairing lexicographic soft-penalty order and adds
 * hardViolationCount between feasibility and soft authority penalties.
 *
 * Optimizer MUST NOT invent a different authority ladder.
 */

import {
  getCandidateScoreBreakdown,
  normalizeScoreBreakdown,
} from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";

const SOFT_KEYS = Object.freeze([
  "superAdminPenalty",
  "tournamentPenalty",
  "clubPenalty",
  "sessionPenalty",
  "defaultPenalty",
]);

/**
 * @param {object} candidate
 * @returns {import('./optimizationTypes.js').OptimizationCandidateScore}
 */
export function toAuthorityScore(candidate = {}) {
  const breakdown = getCandidateScoreBreakdown(candidate);
  const hardViolationCount = Math.max(
    0,
    Number(
      candidate.hardViolationCount ??
        candidate.rejectionCodes?.length ??
        (candidate.feasible === false ? 1 : 0)
    ) || 0
  );
  const feasible =
    candidate.feasible !== false && hardViolationCount === 0;

  return {
    feasible,
    hardViolationCount,
    ...breakdown,
    diagnostics: candidate.diagnostics || candidate.scoreDiagnostics || {},
  };
}

/**
 * Lexicographic compare — lower is better after feasibility.
 * @returns {number} <0 if a better than b
 */
export function compareAuthorityCandidates(a, b) {
  const scoreA = toAuthorityScore(a);
  const scoreB = toAuthorityScore(b);

  if (scoreA.feasible !== scoreB.feasible) {
    return scoreA.feasible ? -1 : 1;
  }

  if (scoreA.hardViolationCount !== scoreB.hardViolationCount) {
    return scoreA.hardViolationCount - scoreB.hardViolationCount;
  }

  for (const key of SOFT_KEYS) {
    if (scoreA[key] !== scoreB[key]) {
      return scoreA[key] - scoreB[key];
    }
  }

  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

/**
 * @param {object[]} candidates
 * @returns {object[]}
 */
export function sortByAuthorityRank(candidates = []) {
  return [...candidates].sort(compareAuthorityCandidates);
}

/**
 * True when `challenger` is strictly better than `incumbent`.
 */
export function isStrictlyBetterCandidate(challenger, incumbent) {
  if (!incumbent) return Boolean(challenger);
  return compareAuthorityCandidates(challenger, incumbent) < 0;
}

/**
 * True when challenger is not worse than baseline (≤ in lexicographic order).
 */
export function isNotWorseThanBaseline(challenger, baseline) {
  if (!baseline) return true;
  if (!challenger) return false;
  return compareAuthorityCandidates(challenger, baseline) <= 0;
}

export { normalizeScoreBreakdown, getCandidateScoreBreakdown };

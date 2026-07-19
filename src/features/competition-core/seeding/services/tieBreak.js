/**
 * Phase 3G — deterministic candidate ordering / tie-break.
 * Never uses Math.random.
 */

import { ASSIGNMENT_REASON } from "../enums/assignmentReasons.js";
import { deterministicTieKey } from "./deterministicRandom.js";

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function finiteOrNull(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare two candidates for automatic seed ordering.
 * Order: ranking ASC → rating DESC → sourcePriority ASC →
 *        deterministic tie key (if seed) → identity key ASC.
 *
 * @param {import('../contracts/seedingCandidate.js').SeedingCandidate} left
 * @param {import('../contracts/seedingCandidate.js').SeedingCandidate} right
 * @param {{
 *   deterministicSeed?: unknown,
 *   policyCompare?: (a: import('../contracts/seedingCandidate.js').SeedingCandidate, b: import('../contracts/seedingCandidate.js').SeedingCandidate) => number|null,
 * }} [options]
 * @returns {{ cmp: number, trace: string[] }}
 */
export function compareCandidatesForSeed(left, right, options = {}) {
  /** @type {string[]} */
  const trace = [];

  if (typeof options.policyCompare === "function") {
    const policyCmp = options.policyCompare(left, right);
    if (policyCmp != null && policyCmp !== 0) {
      trace.push(ASSIGNMENT_REASON.POLICY);
      return { cmp: policyCmp < 0 ? -1 : 1, trace };
    }
  }

  const leftRank = finiteOrNull(left.rankingPosition);
  const rightRank = finiteOrNull(right.rankingPosition);
  if (leftRank != null || rightRank != null) {
    if (leftRank == null && rightRank != null) {
      trace.push(ASSIGNMENT_REASON.RANKING_ORDER);
      return { cmp: 1, trace };
    }
    if (rightRank == null && leftRank != null) {
      trace.push(ASSIGNMENT_REASON.RANKING_ORDER);
      return { cmp: -1, trace };
    }
    if (leftRank !== rightRank) {
      trace.push(ASSIGNMENT_REASON.RANKING_ORDER);
      return { cmp: leftRank < rightRank ? -1 : 1, trace };
    }
  }

  const leftRating = finiteOrNull(left.ratingValue);
  const rightRating = finiteOrNull(right.ratingValue);
  if (leftRating != null || rightRating != null) {
    if (leftRating == null && rightRating != null) {
      trace.push(ASSIGNMENT_REASON.RATING_ORDER);
      return { cmp: 1, trace };
    }
    if (rightRating == null && leftRating != null) {
      trace.push(ASSIGNMENT_REASON.RATING_ORDER);
      return { cmp: -1, trace };
    }
    if (leftRating !== rightRating) {
      trace.push(ASSIGNMENT_REASON.RATING_ORDER);
      return { cmp: leftRating > rightRating ? -1 : 1, trace };
    }
  }

  const leftPriority = finiteOrNull(left.sourcePriority);
  const rightPriority = finiteOrNull(right.sourcePriority);
  if (leftPriority != null || rightPriority != null) {
    if (leftPriority == null && rightPriority != null) {
      trace.push(ASSIGNMENT_REASON.SOURCE_PRIORITY);
      return { cmp: 1, trace };
    }
    if (rightPriority == null && leftPriority != null) {
      trace.push(ASSIGNMENT_REASON.SOURCE_PRIORITY);
      return { cmp: -1, trace };
    }
    if (leftPriority !== rightPriority) {
      trace.push(ASSIGNMENT_REASON.SOURCE_PRIORITY);
      return { cmp: leftPriority < rightPriority ? -1 : 1, trace };
    }
  }

  if (options.deterministicSeed !== undefined && options.deterministicSeed !== null) {
    const leftKey = deterministicTieKey(
      options.deterministicSeed,
      left.candidateIdentityKey
    );
    const rightKey = deterministicTieKey(
      options.deterministicSeed,
      right.candidateIdentityKey
    );
    if (leftKey !== rightKey) {
      trace.push(ASSIGNMENT_REASON.DETERMINISTIC_RANDOM);
      return { cmp: leftKey < rightKey ? -1 : 1, trace };
    }
  }

  const leftId = String(left.candidateIdentityKey || left.candidateReference || "");
  const rightId = String(right.candidateIdentityKey || right.candidateReference || "");
  if (leftId !== rightId) {
    trace.push(ASSIGNMENT_REASON.IDENTITY_ORDER);
    return { cmp: leftId < rightId ? -1 : 1, trace };
  }

  return { cmp: 0, trace };
}

/**
 * Stable sort of automatic candidates.
 *
 * @param {import('../contracts/seedingCandidate.js').SeedingCandidate[]} candidates
 * @param {{
 *   deterministicSeed?: unknown,
 *   policyCompare?: (a: import('../contracts/seedingCandidate.js').SeedingCandidate, b: import('../contracts/seedingCandidate.js').SeedingCandidate) => number|null,
 * }} [options]
 * @returns {{
 *   ordered: import('../contracts/seedingCandidate.js').SeedingCandidate[],
 *   traces: Map<string, string[]>,
 * }}
 */
export function orderCandidatesDeterministically(candidates = [], options = {}) {
  /** @type {Map<string, string[]>} */
  const traces = new Map();
  const ordered = [...candidates];

  ordered.sort((a, b) => {
    const { cmp, trace } = compareCandidatesForSeed(a, b, options);
    if (trace.length) {
      const existingA = traces.get(a.candidateIdentityKey) || [];
      traces.set(a.candidateIdentityKey, [...existingA, ...trace]);
    }
    return cmp;
  });

  return { ordered, traces };
}

/** @deprecated name alias used by audit tree */
export function deterministicOrdering(candidates, options) {
  return orderCandidatesDeterministically(candidates, options);
}

/** tieBreak service alias */
export function tieBreak(left, right, options) {
  return compareCandidatesForSeed(left, right, options);
}

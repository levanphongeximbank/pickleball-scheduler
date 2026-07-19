/**
 * Phase 3G — SeedingPolicy interface (format-agnostic).
 */

/**
 * @typedef {Object} SeedingPolicyResult
 * @property {boolean} ok
 * @property {string[]} [reasons]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} SeedingPolicy
 * @property {string} id
 * @property {(candidates: unknown[], context?: Record<string, unknown>) => boolean} supports
 * @property {(candidates: import('./seedingCandidate.js').SeedingCandidate[], context?: Record<string, unknown>) => SeedingPolicyResult} validateCandidates
 * @property {(candidate: import('./seedingCandidate.js').SeedingCandidate, context?: Record<string, unknown>) => boolean} isEligible
 * @property {(left: import('./seedingCandidate.js').SeedingCandidate, right: import('./seedingCandidate.js').SeedingCandidate, context?: Record<string, unknown>) => number|null} [compareCandidates]
 * @property {(context?: Record<string, unknown>) => boolean} [allowRandom]
 * @property {(context?: Record<string, unknown>) => boolean} [allowPartialManual]
 */

/**
 * @param {Partial<SeedingPolicyResult>} [partial]
 * @returns {SeedingPolicyResult}
 */
export function createSeedingPolicyResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    reasons: Array.isArray(partial.reasons)
      ? partial.reasons.map((r) => String(r))
      : [],
    details:
      partial.details && typeof partial.details === "object"
        ? { ...partial.details }
        : {},
  };
}

/**
 * @param {unknown} policy
 * @returns {policy is SeedingPolicy}
 */
export function isSeedingPolicy(policy) {
  return (
    !!policy &&
    typeof policy === "object" &&
    typeof policy.id === "string" &&
    typeof policy.supports === "function" &&
    typeof policy.validateCandidates === "function" &&
    typeof policy.isEligible === "function"
  );
}

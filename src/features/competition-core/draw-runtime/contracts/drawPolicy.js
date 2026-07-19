/**
 * Phase 3H — DrawPolicy interface (format-agnostic).
 */

/**
 * @typedef {Object} DrawPolicyResult
 * @property {boolean} ok
 * @property {string[]} [reasons]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} DrawPolicy
 * @property {string} id
 * @property {(request: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(candidates: import('./drawCandidate.js').DrawCandidate[], context?: Record<string, unknown>) => DrawPolicyResult} validateCandidates
 * @property {(candidate: import('./drawCandidate.js').DrawCandidate, context?: Record<string, unknown>) => boolean} isEligible
 * @property {(context?: Record<string, unknown>) => boolean} [allowNonPowerOfTwo]
 * @property {(context?: Record<string, unknown>) => boolean} [allowPartialManual]
 * @property {(context?: Record<string, unknown>) => boolean} [allowEmptyGroups]
 */

/**
 * @param {Partial<DrawPolicyResult>} [partial]
 * @returns {DrawPolicyResult}
 */
export function createDrawPolicyResult(partial = {}) {
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
 * @returns {policy is DrawPolicy}
 */
export function isDrawPolicy(policy) {
  return (
    !!policy &&
    typeof policy === "object" &&
    typeof policy.id === "string" &&
    typeof policy.supports === "function" &&
    typeof policy.validateCandidates === "function" &&
    typeof policy.isEligible === "function"
  );
}

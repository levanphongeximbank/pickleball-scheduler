/**
 * Phase 3F — MatchPolicy interface (injected format rules).
 * Core must not hard-code TT discipline / WO / forfeit authority rules.
 */

/**
 * @typedef {Object} MatchPolicyContext
 * @property {import('./competitionMatch.js').CompetitionMatch} match
 * @property {import('./matchIdentity.js').MatchIdentity|null} [identity]
 * @property {unknown} [fixture]
 * @property {unknown} [lineup]
 * @property {string|null} [action]
 * @property {string|null} [actorRole]
 * @property {string|Date|null} [now]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {Object} MatchPolicyResult
 * @property {boolean} ok
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} MatchPolicy
 * @property {string} id
 * @property {(context?: Record<string, unknown>) => boolean} [supports]
 * @property {(ctx: MatchPolicyContext) => MatchPolicyResult|Promise<MatchPolicyResult>} [validateComposition]
 * @property {(ctx: MatchPolicyContext) => MatchPolicyResult|Promise<MatchPolicyResult>} [canStart]
 * @property {(ctx: MatchPolicyContext) => MatchPolicyResult|Promise<MatchPolicyResult>} [canComplete]
 * @property {(ctx: MatchPolicyContext) => MatchPolicyResult|Promise<MatchPolicyResult>} [authorizeOutcome]
 * @property {(ctx: MatchPolicyContext) => MatchPolicyResult|Promise<MatchPolicyResult>} [assertTransition]
 */

/**
 * @param {Partial<MatchPolicyResult>|null|undefined} partial
 * @returns {MatchPolicyResult}
 */
export function createMatchPolicyResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    code: typeof partial?.code === "string" ? partial.code : null,
    message: typeof partial?.message === "string" ? partial.message : null,
    details:
      partial?.details && typeof partial.details === "object"
        ? { ...partial.details }
        : {},
  };
}

/**
 * @param {unknown} policy
 * @returns {policy is MatchPolicy}
 */
export function isMatchPolicy(policy) {
  return (
    !!policy &&
    typeof policy === "object" &&
    typeof policy.id === "string" &&
    (typeof policy.validateComposition === "function" ||
      typeof policy.canStart === "function" ||
      typeof policy.canComplete === "function" ||
      typeof policy.authorizeOutcome === "function" ||
      typeof policy.assertTransition === "function" ||
      typeof policy.supports === "function")
  );
}

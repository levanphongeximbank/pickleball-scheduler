/**
 * Phase 3E — LineupPolicy interface (injected format rules).
 * Core must not hard-code Team Tournament gender/MLP/deadline rules.
 */

/**
 * @typedef {Object} LineupPolicyContext
 * @property {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup} lineup
 * @property {import('./lineupIdentity.js').LineupIdentity|null} [identity]
 * @property {unknown} [roster]
 * @property {unknown} [team]
 * @property {unknown} [matchContext]
 * @property {string|null} [action]
 * @property {string|null} [actorRole]
 * @property {string|Date|null} [now]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {Object} LineupPolicyResult
 * @property {boolean} ok
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} LineupPolicy
 * @property {string} id
 * @property {(context?: Record<string, unknown>) => boolean} [supports]
 * @property {(ctx: LineupPolicyContext) => LineupPolicyResult|Promise<LineupPolicyResult>} [validateSlots]
 * @property {(ctx: LineupPolicyContext) => LineupPolicyResult|Promise<LineupPolicyResult>} [assertTransition]
 * @property {(ctx: LineupPolicyContext) => LineupPolicyResult|Promise<LineupPolicyResult>} [evaluateDeadline]
 */

/**
 * @param {Partial<LineupPolicyResult>|null|undefined} partial
 * @returns {LineupPolicyResult}
 */
export function createLineupPolicyResult(partial = {}) {
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
 * @returns {policy is LineupPolicy}
 */
export function isLineupPolicy(policy) {
  return (
    !!policy &&
    typeof policy === "object" &&
    typeof policy.id === "string" &&
    (typeof policy.validateSlots === "function" ||
      typeof policy.assertTransition === "function" ||
      typeof policy.evaluateDeadline === "function" ||
      typeof policy.supports === "function")
  );
}

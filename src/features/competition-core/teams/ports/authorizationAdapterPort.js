/**
 * Core-05 — authorization adapter port.
 * Default: deny all.
 */

export const TEAM_ROSTER_AUTH_ACTION = Object.freeze({
  TEAM_ROSTER_UNLOCK: "TEAM_ROSTER_UNLOCK",
  TEAM_WITHDRAW: "TEAM_WITHDRAW",
  TEAM_ACTIVATE: "TEAM_ACTIVATE",
  ROSTER_LOCK: "ROSTER_LOCK",
});

/**
 * @typedef {Object} TeamAuthorizationRequest
 * @property {string} action
 * @property {string|null} [actor]
 * @property {unknown} [team]
 * @property {unknown} [roster]
 * @property {Record<string, unknown>} [context]
 */

/**
 * @typedef {Object} TeamAuthorizationResult
 * @property {boolean} allowed
 * @property {string|null} [reason]
 */

/**
 * @typedef {Object} TeamAuthorizationAdapter
 * @property {(request: TeamAuthorizationRequest) => TeamAuthorizationResult|Promise<TeamAuthorizationResult>} authorize
 */

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function matchesAuthorizationAdapter(adapter) {
  return Boolean(adapter && typeof adapter === "object" && typeof adapter.authorize === "function");
}

/**
 * @returns {TeamAuthorizationAdapter}
 */
export function createDenyAuthorizationAdapter() {
  return {
    async authorize(request) {
      return {
        allowed: false,
        reason: `Authorization denied for action ${String(request?.action || "")}`,
      };
    },
  };
}

/**
 * @param {Iterable<string>|string[]} [allowedActions]
 * @returns {TeamAuthorizationAdapter}
 */
export function createAllowlistAuthorizationAdapter(allowedActions = []) {
  const allowed = new Set(
    [...allowedActions].map((a) => String(a)).filter(Boolean)
  );
  return {
    async authorize(request) {
      const action = String(request?.action || "");
      if (allowed.has(action)) {
        return { allowed: true, reason: null };
      }
      return {
        allowed: false,
        reason: `Action ${action} not in allowlist`,
      };
    },
  };
}

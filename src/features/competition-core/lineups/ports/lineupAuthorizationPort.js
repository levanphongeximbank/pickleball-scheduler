/**
 * CORE-06 Phase 1C — LineupAuthorizationPort (contract + deny/allowlist doubles).
 */

export const LINEUP_AUTH_ACTION = Object.freeze({
  DRAFT: "LINEUP_DRAFT",
  SUBMIT: "LINEUP_SUBMIT",
  LOCK: "LINEUP_LOCK",
  PUBLISH: "LINEUP_PUBLISH",
  OVERRIDE: "LINEUP_OVERRIDE",
  VOID: "LINEUP_VOID",
  VIEW_OWN: "LINEUP_VIEW_OWN",
  VIEW_OPPONENT: "LINEUP_VIEW_OPPONENT",
});

/**
 * @typedef {Object} LineupAuthorizationRequest
 * @property {string} action
 * @property {string|null} [actorId]
 * @property {string|null} [actorRole]
 * @property {unknown} [lineup]
 * @property {Record<string, unknown>} [context]
 */

/**
 * @typedef {Object} LineupAuthorizationResult
 * @property {boolean} allowed
 * @property {string|null} [reason]
 */

/**
 * @typedef {Object} LineupAuthorizationPort
 * @property {(request: LineupAuthorizationRequest) => LineupAuthorizationResult|Promise<LineupAuthorizationResult>} authorize
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupAuthorizationPort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.authorize === "function"
  );
}

/**
 * @returns {LineupAuthorizationPort}
 */
export function createDenyLineupAuthorizationPort() {
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
 * @returns {LineupAuthorizationPort}
 */
export function createAllowlistLineupAuthorizationPort(allowedActions = []) {
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

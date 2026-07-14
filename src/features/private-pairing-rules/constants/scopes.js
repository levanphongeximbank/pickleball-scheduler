/** Application scope for private pairing rules (not Competition Core domain scope). */
export const PRIVATE_PAIRING_SCOPE = Object.freeze({
  GLOBAL: "GLOBAL",
  TENANT: "TENANT",
  CLUB: "CLUB",
  VENUE: "VENUE",
  TOURNAMENT: "TOURNAMENT",
  TOURNAMENT_EVENT: "TOURNAMENT_EVENT",
  DAILY_PLAY_SESSION: "DAILY_PLAY_SESSION",
  ROUND: "ROUND",
  MATCH_DAY: "MATCH_DAY",
});

/** @type {ReadonlySet<string>} */
export const PRIVATE_PAIRING_SCOPE_VALUES = new Set(Object.values(PRIVATE_PAIRING_SCOPE));

/** Scopes that require a non-empty scopeId. */
export const SCOPES_REQUIRING_ID = Object.freeze([
  PRIVATE_PAIRING_SCOPE.TENANT,
  PRIVATE_PAIRING_SCOPE.CLUB,
  PRIVATE_PAIRING_SCOPE.VENUE,
  PRIVATE_PAIRING_SCOPE.TOURNAMENT,
  PRIVATE_PAIRING_SCOPE.TOURNAMENT_EVENT,
  PRIVATE_PAIRING_SCOPE.DAILY_PLAY_SESSION,
  PRIVATE_PAIRING_SCOPE.ROUND,
  PRIVATE_PAIRING_SCOPE.MATCH_DAY,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPrivatePairingScope(value) {
  return typeof value === "string" && PRIVATE_PAIRING_SCOPE_VALUES.has(value);
}

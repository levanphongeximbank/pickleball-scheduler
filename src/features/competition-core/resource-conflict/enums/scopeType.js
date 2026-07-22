/**
 * CORE-14 — ScopeType. Unknown values fail closed.
 */

export const SCOPE_TYPE = Object.freeze({
  GLOBAL: "GLOBAL",
  TENANT: "TENANT",
  CLUB: "CLUB",
  VENUE: "VENUE",
  COMPETITION: "COMPETITION",
  EVENT: "EVENT",
});

export const SCOPE_TYPE_VALUES = Object.freeze([
  SCOPE_TYPE.GLOBAL,
  SCOPE_TYPE.TENANT,
  SCOPE_TYPE.CLUB,
  SCOPE_TYPE.VENUE,
  SCOPE_TYPE.COMPETITION,
  SCOPE_TYPE.EVENT,
]);

const SCOPE_TYPE_SET = new Set(SCOPE_TYPE_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isScopeType(value) {
  return typeof value === "string" && SCOPE_TYPE_SET.has(value);
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 */
export function resolveScopeType(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "SCOPE_TYPE_REQUIRED" };
  }
  if (!isScopeType(value)) {
    return { ok: false, reason: "SCOPE_TYPE_UNKNOWN" };
  }
  return { ok: true, value: /** @type {string} */ (value) };
}

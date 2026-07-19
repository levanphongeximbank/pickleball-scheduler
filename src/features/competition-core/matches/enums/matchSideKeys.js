/**
 * Phase 3F — canonical match side keys.
 */

export const MATCH_SIDE_KEY = Object.freeze({
  A: "A",
  B: "B",
});

/** @type {ReadonlySet<string>} */
export const MATCH_SIDE_KEY_VALUES = new Set(Object.values(MATCH_SIDE_KEY));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchSideKey(value) {
  return typeof value === "string" && MATCH_SIDE_KEY_VALUES.has(value);
}

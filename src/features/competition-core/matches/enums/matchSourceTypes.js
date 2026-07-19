/**
 * Phase 3F — match source type enum.
 */

export const MATCH_SOURCE_TYPE = Object.freeze({
  LEGACY_MATCH: "LEGACY_MATCH",
  LEGACY_SUB_MATCH: "LEGACY_SUB_MATCH",
  CANONICAL_MATCH: "CANONICAL_MATCH",
});

/** @type {ReadonlySet<string>} */
export const MATCH_SOURCE_TYPE_VALUES = new Set(
  Object.values(MATCH_SOURCE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchSourceType(value) {
  return typeof value === "string" && MATCH_SOURCE_TYPE_VALUES.has(value);
}

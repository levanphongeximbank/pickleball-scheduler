/**
 * Phase 3E — lineup source type enum.
 */

export const LINEUP_SOURCE_TYPE = Object.freeze({
  LEGACY_LINEUP: "LEGACY_LINEUP",
  CANONICAL_LINEUP: "CANONICAL_LINEUP",
});

/** @type {ReadonlySet<string>} */
export const LINEUP_SOURCE_TYPE_VALUES = new Set(
  Object.values(LINEUP_SOURCE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLineupSourceType(value) {
  return typeof value === "string" && LINEUP_SOURCE_TYPE_VALUES.has(value);
}

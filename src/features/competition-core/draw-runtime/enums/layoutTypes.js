/** Phase 3H — draw layout types. */

export const LAYOUT_TYPE = Object.freeze({
  GROUPS: "GROUPS",
  BRACKET: "BRACKET",
  HYBRID: "HYBRID",
  NOOP: "NOOP",
});

/** @type {ReadonlySet<string>} */
export const LAYOUT_TYPE_VALUES = new Set(Object.values(LAYOUT_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLayoutType(value) {
  return typeof value === "string" && LAYOUT_TYPE_VALUES.has(value);
}

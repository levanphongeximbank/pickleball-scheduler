/** Phase 3H — placement type kinds. */

export const PLACEMENT_TYPE = Object.freeze({
  GROUP: "GROUP",
  BRACKET_SLOT: "BRACKET_SLOT",
  BYE: "BYE",
  MANUAL: "MANUAL",
  PROTECTED: "PROTECTED",
  UNRESOLVED: "UNRESOLVED",
});

/** @type {ReadonlySet<string>} */
export const PLACEMENT_TYPE_VALUES = new Set(Object.values(PLACEMENT_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlacementType(value) {
  return typeof value === "string" && PLACEMENT_TYPE_VALUES.has(value);
}

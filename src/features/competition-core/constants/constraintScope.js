/** @typedef {import('../types/constraintScope.js').ConstraintScopeValue} ConstraintScopeValue */

export const CONSTRAINT_SCOPE = Object.freeze({
  PAIRING: "pairing",
  GROUP: "group",
  MATCH: "match",
  DRAW: "draw",
  LINEUP: "lineup",
  ENTRY: "entry",
});

/** @type {ReadonlySet<ConstraintScopeValue>} */
export const CONSTRAINT_SCOPE_VALUES = new Set(Object.values(CONSTRAINT_SCOPE));

/**
 * @param {unknown} value
 * @returns {value is ConstraintScopeValue}
 */
export function isConstraintScope(value) {
  return typeof value === "string" && CONSTRAINT_SCOPE_VALUES.has(/** @type {ConstraintScopeValue} */ (value));
}

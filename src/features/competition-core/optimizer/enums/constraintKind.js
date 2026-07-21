/**
 * CORE-10 — constraint / objective sense enums.
 */

export const CONSTRAINT_KIND = Object.freeze({
  HARD: "HARD",
  SOFT: "SOFT",
});

export const CONSTRAINT_KIND_VALUES = Object.freeze(
  Object.values(CONSTRAINT_KIND)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isConstraintKind(value) {
  return typeof value === "string" && CONSTRAINT_KIND_VALUES.includes(value);
}

export const OBJECTIVE_SENSE = Object.freeze({
  MINIMIZE: "MINIMIZE",
  MAXIMIZE: "MAXIMIZE",
});

export const OBJECTIVE_SENSE_VALUES = Object.freeze(
  Object.values(OBJECTIVE_SENSE)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isObjectiveSense(value) {
  return typeof value === "string" && OBJECTIVE_SENSE_VALUES.includes(value);
}

export const COURT_CONSTRAINT_KIND = Object.freeze({
  HARD: "HARD",
  SOFT: "SOFT",
});

export const COURT_CONSTRAINT_KIND_VALUES = Object.freeze(
  Object.values(COURT_CONSTRAINT_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCourtConstraintKind(value) {
  return COURT_CONSTRAINT_KIND_VALUES.includes(/** @type {string} */ (value));
}

export const CONFLICT_SEVERITY = Object.freeze({
  HARD: "HARD",
  SOFT: "SOFT",
  INFO: "INFO",
});

export const CONFLICT_SEVERITY_VALUES = Object.freeze(
  Object.values(CONFLICT_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConflictSeverity(value) {
  return CONFLICT_SEVERITY_VALUES.includes(/** @type {string} */ (value));
}

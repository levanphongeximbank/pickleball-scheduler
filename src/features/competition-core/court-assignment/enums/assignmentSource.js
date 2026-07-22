export const COURT_ASSIGNMENT_SOURCE = Object.freeze({
  AUTO: "AUTO",
  LOCKED: "LOCKED",
  PRESERVED: "PRESERVED",
});

export const COURT_ASSIGNMENT_SOURCE_VALUES = Object.freeze(
  Object.values(COURT_ASSIGNMENT_SOURCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCourtAssignmentSource(value) {
  return COURT_ASSIGNMENT_SOURCE_VALUES.includes(/** @type {string} */ (value));
}

export const COURT_LOCK_SOURCE = Object.freeze({
  MANUAL: "MANUAL",
  DIRECTOR: "DIRECTOR",
  IMPORT: "IMPORT",
  POLICY: "POLICY",
});

export const COURT_LOCK_SOURCE_VALUES = Object.freeze(
  Object.values(COURT_LOCK_SOURCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCourtLockSource(value) {
  return COURT_LOCK_SOURCE_VALUES.includes(/** @type {string} */ (value));
}

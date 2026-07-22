export const CAPABILITY_MATCH_MODE = Object.freeze({
  IGNORE: "IGNORE",
  HARD: "HARD",
  SOFT: "SOFT",
});

export const CAPABILITY_MATCH_MODE_VALUES = Object.freeze(
  Object.values(CAPABILITY_MATCH_MODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCapabilityMatchMode(value) {
  return CAPABILITY_MATCH_MODE_VALUES.includes(/** @type {string} */ (value));
}

export const OVERLAP_MODE = Object.freeze({
  HALF_OPEN: "HALF_OPEN",
});

export const OVERLAP_MODE_VALUES = Object.freeze(Object.values(OVERLAP_MODE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isOverlapMode(value) {
  return OVERLAP_MODE_VALUES.includes(/** @type {string} */ (value));
}

/** Behavior when a known lock is infeasible after request validation. */
export const INVALID_LOCK_BEHAVIOR = Object.freeze({
  CONFLICT: "CONFLICT",
  REJECT_REQUEST: "REJECT_REQUEST",
});

export const INVALID_LOCK_BEHAVIOR_VALUES = Object.freeze(
  Object.values(INVALID_LOCK_BEHAVIOR)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isInvalidLockBehavior(value) {
  return INVALID_LOCK_BEHAVIOR_VALUES.includes(/** @type {string} */ (value));
}

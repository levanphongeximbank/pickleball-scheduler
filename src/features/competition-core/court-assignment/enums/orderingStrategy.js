export const MATCH_ORDERING_STRATEGY = Object.freeze({
  STABLE_PRIORITY_THEN_ID: "STABLE_PRIORITY_THEN_ID",
  STABLE_ID_ONLY: "STABLE_ID_ONLY",
  STABLE_START_THEN_ID: "STABLE_START_THEN_ID",
});

export const MATCH_ORDERING_STRATEGY_VALUES = Object.freeze(
  Object.values(MATCH_ORDERING_STRATEGY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchOrderingStrategy(value) {
  return MATCH_ORDERING_STRATEGY_VALUES.includes(/** @type {string} */ (value));
}

export const COURT_ORDERING_STRATEGY = Object.freeze({
  STABLE_PRIORITY_THEN_ID: "STABLE_PRIORITY_THEN_ID",
  STABLE_ID_ONLY: "STABLE_ID_ONLY",
});

export const COURT_ORDERING_STRATEGY_VALUES = Object.freeze(
  Object.values(COURT_ORDERING_STRATEGY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCourtOrderingStrategy(value) {
  return COURT_ORDERING_STRATEGY_VALUES.includes(/** @type {string} */ (value));
}

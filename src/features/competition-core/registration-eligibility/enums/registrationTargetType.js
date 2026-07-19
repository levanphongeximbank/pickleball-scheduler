/**
 * Core-03 — registration target shapes (future-compatible).
 * PAIR is a first-class target; do not collapse into INDIVIDUAL.
 */

export const REGISTRATION_TARGET_TYPE = Object.freeze({
  INDIVIDUAL: "INDIVIDUAL",
  PAIR: "PAIR",
  TEAM: "TEAM",
});

/** @type {ReadonlySet<string>} */
export const REGISTRATION_TARGET_TYPE_VALUES = new Set(
  Object.values(REGISTRATION_TARGET_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationTargetType(value) {
  return typeof value === "string" && REGISTRATION_TARGET_TYPE_VALUES.has(value);
}

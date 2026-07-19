/**
 * Phase 3C — Owner-locked registration kinds.
 * Pair = metadata. Guest = Participant type. Representative/Captain = roles.
 */

export const REGISTRATION_KIND = Object.freeze({
  INDIVIDUAL: "INDIVIDUAL",
  TEAM: "TEAM",
});

/** @type {ReadonlySet<string>} */
export const REGISTRATION_KIND_VALUES = new Set(Object.values(REGISTRATION_KIND));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationKind(value) {
  return typeof value === "string" && REGISTRATION_KIND_VALUES.has(value);
}

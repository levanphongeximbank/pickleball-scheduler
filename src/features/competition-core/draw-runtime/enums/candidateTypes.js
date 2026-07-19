/** Phase 3H — draw candidate types. */

export const CANDIDATE_TYPE = Object.freeze({
  ENTRY: "ENTRY",
  TEAM: "TEAM",
  PARTICIPANT: "PARTICIPANT",
  UNKNOWN: "UNKNOWN",
});

/** @type {ReadonlySet<string>} */
export const CANDIDATE_TYPE_VALUES = new Set(Object.values(CANDIDATE_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCandidateType(value) {
  return typeof value === "string" && CANDIDATE_TYPE_VALUES.has(value);
}

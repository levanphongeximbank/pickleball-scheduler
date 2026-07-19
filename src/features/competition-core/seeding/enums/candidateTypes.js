/** Phase 3G — seeding candidate type enum. */

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

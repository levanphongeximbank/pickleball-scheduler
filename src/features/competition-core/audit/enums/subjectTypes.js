/**
 * CORE-20 — subject type allowlist for SubjectReference.
 */

export const SUBJECT_TYPE = Object.freeze({
  COMPETITION: "competition",
  PARTICIPANT: "participant",
  ENTRY: "entry",
  DRAW: "draw",
  MATCHUP: "matchup",
  SCHEDULE: "schedule",
  COURT_ASSIGNMENT: "courtAssignment",
  REFEREE_ASSIGNMENT: "refereeAssignment",
  MATCH: "match",
  SCORE: "score",
  RESULT: "result",
  STANDINGS: "standings",
  WORKFLOW: "workflow",
});

/** @type {ReadonlySet<string>} */
export const SUBJECT_TYPE_VALUES = new Set(Object.values(SUBJECT_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSubjectType(value) {
  return typeof value === "string" && SUBJECT_TYPE_VALUES.has(value);
}

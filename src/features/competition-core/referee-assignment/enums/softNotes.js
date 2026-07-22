/**
 * CORE-13 — soft note codes (canonical; never free-text-only decisions).
 */

export const REFEREE_SOFT_NOTE_CODE = Object.freeze({
  PREFERRED_TAG_MISSING: "PREFERRED_TAG_MISSING",
  PREFERRED_ROLE_MISMATCH: "PREFERRED_ROLE_MISMATCH",
  AFFILIATED_TEAM: "AFFILIATED_TEAM",
  AFFILIATED_CLUB: "AFFILIATED_CLUB",
  AFFILIATED_ORGANIZATION: "AFFILIATED_ORGANIZATION",
  WORKLOAD_ABOVE_PEER: "WORKLOAD_ABOVE_PEER",
  EXPERIENCE_BELOW_PREFERRED: "EXPERIENCE_BELOW_PREFERRED",
  DIVISION_UNFAMILIAR: "DIVISION_UNFAMILIAR",
  CONTINUITY_BREAK: "CONTINUITY_BREAK",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_SOFT_NOTE_CODE_VALUES = new Set(
  Object.values(REFEREE_SOFT_NOTE_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeSoftNoteCode(value) {
  return typeof value === "string" && REFEREE_SOFT_NOTE_CODE_VALUES.has(value);
}

/**
 * Soft objective keys for lexicographic ranking (lower-is-better after normalization).
 */
export const REFEREE_SOFT_OBJECTIVE_KEY = Object.freeze({
  WORKLOAD_BALANCE: "WORKLOAD_BALANCE",
  CONSECUTIVE_MATCH_MINIMIZATION: "CONSECUTIVE_MATCH_MINIMIZATION",
  COURT_TRANSITION_MINIMIZATION: "COURT_TRANSITION_MINIMIZATION",
  ROLE_PREFERENCE: "ROLE_PREFERENCE",
  EXPERIENCE_PREFERENCE: "EXPERIENCE_PREFERENCE",
  DIVISION_FAMILIARITY: "DIVISION_FAMILIARITY",
  AFFILIATION_NEUTRALITY: "AFFILIATION_NEUTRALITY",
  ASSIGNMENT_CONTINUITY: "ASSIGNMENT_CONTINUITY",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_SOFT_OBJECTIVE_KEY_VALUES = new Set(
  Object.values(REFEREE_SOFT_OBJECTIVE_KEY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeSoftObjectiveKey(value) {
  return (
    typeof value === "string" && REFEREE_SOFT_OBJECTIVE_KEY_VALUES.has(value)
  );
}

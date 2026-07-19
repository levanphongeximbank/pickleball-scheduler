/**
 * Core-02 — Competition Entry competing-unit types.
 *
 * Distinct from:
 * - ParticipantReference.kind (person source identity)
 * - CompetitionParticipant (one person in a competition)
 * - REGISTRATION_KIND (workflow; remains INDIVIDUAL | TEAM)
 */

export const COMPETITION_ENTRY_TYPE = Object.freeze({
  INDIVIDUAL: "INDIVIDUAL",
  PAIR: "PAIR",
  TEAM: "TEAM",
});

/** @type {ReadonlySet<string>} */
export const COMPETITION_ENTRY_TYPE_VALUES = new Set(Object.values(COMPETITION_ENTRY_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionEntryType(value) {
  return typeof value === "string" && COMPETITION_ENTRY_TYPE_VALUES.has(value);
}

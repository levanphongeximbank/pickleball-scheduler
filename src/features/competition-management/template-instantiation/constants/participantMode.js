/**
 * Participant structure mode proposed by a template (CM-02).
 * Reference-level only — does not own CORE team/roster execution.
 */

export const COMPETITION_TEMPLATE_PARTICIPANT_MODE = Object.freeze({
  INDIVIDUAL: "individual",
  TEAM: "team",
  MIXED: "mixed",
});

export const COMPETITION_TEMPLATE_PARTICIPANT_MODE_VALUES = Object.freeze(
  Object.values(COMPETITION_TEMPLATE_PARTICIPANT_MODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionTemplateParticipantMode(value) {
  return (
    typeof value === "string" &&
    COMPETITION_TEMPLATE_PARTICIPANT_MODE_VALUES.includes(value)
  );
}

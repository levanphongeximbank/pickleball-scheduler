/**
 * Participant mode at management-configuration level (CM-04).
 * Aligns with CM-02 template participant mode vocabulary; does not execute roster/team CORE.
 */

export const COMPETITION_CONFIGURATION_PARTICIPANT_MODE = Object.freeze({
  INDIVIDUAL: "individual",
  TEAM: "team",
  MIXED: "mixed",
});

export const COMPETITION_CONFIGURATION_PARTICIPANT_MODE_VALUES = Object.freeze(
  Object.values(COMPETITION_CONFIGURATION_PARTICIPANT_MODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionConfigurationParticipantMode(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CONFIGURATION_PARTICIPANT_MODE_VALUES.includes(value)
  );
}

/**
 * Canonical competition stages for stage-specific rule overrides.
 * Modes may omit stages; presence does not imply every tournament uses them.
 */

export const COMPETITION_RULES_STAGE = Object.freeze({
  GROUP: "GROUP",
  ROUND_OF_32: "ROUND_OF_32",
  ROUND_OF_16: "ROUND_OF_16",
  QUARTERFINAL: "QUARTERFINAL",
  SEMIFINAL: "SEMIFINAL",
  FINAL: "FINAL",
  DECIDING_GAME: "DECIDING_GAME",
});

/** @type {ReadonlyArray<string>} */
export const COMPETITION_RULES_STAGE_VALUES = Object.freeze(
  Object.values(COMPETITION_RULES_STAGE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionRulesStage(value) {
  return (
    typeof value === "string" &&
    COMPETITION_RULES_STAGE_VALUES.includes(value)
  );
}

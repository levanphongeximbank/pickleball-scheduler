/**
 * Official tournament run mode (management parameter).
 * Aligns with legacy OFFICIAL_MODE string values for adapter projection.
 */

export const COMPETITION_CONFIGURATION_OFFICIAL_MODE = Object.freeze({
  OPEN: "official_open",
  AI_BALANCE: "official_ai_balance",
});

export const COMPETITION_CONFIGURATION_OFFICIAL_MODE_VALUES = Object.freeze(
  Object.values(COMPETITION_CONFIGURATION_OFFICIAL_MODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionConfigurationOfficialMode(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CONFIGURATION_OFFICIAL_MODE_VALUES.includes(value)
  );
}

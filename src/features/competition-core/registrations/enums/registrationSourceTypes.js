/**
 * Phase 3C — Registration source types (not kinds).
 * Official BTC is a source type, not a registration kind.
 */

export const REGISTRATION_SOURCE_TYPE = Object.freeze({
  LEGACY_INDIVIDUAL_ENTRY: "LEGACY_INDIVIDUAL_ENTRY",
  LEGACY_TEAM_REGISTRATION: "LEGACY_TEAM_REGISTRATION",
  OFFICIAL_BTC: "OFFICIAL_BTC",
});

/** @type {ReadonlySet<string>} */
export const REGISTRATION_SOURCE_TYPE_VALUES = new Set(
  Object.values(REGISTRATION_SOURCE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationSourceType(value) {
  return typeof value === "string" && REGISTRATION_SOURCE_TYPE_VALUES.has(value);
}

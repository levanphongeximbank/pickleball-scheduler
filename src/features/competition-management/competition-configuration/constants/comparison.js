/**
 * Configuration comparison change types (CM-04).
 */

export const COMPETITION_CONFIGURATION_CHANGE_TYPE = Object.freeze({
  ADDED: "ADDED",
  REMOVED: "REMOVED",
  CHANGED: "CHANGED",
});

export const COMPETITION_CONFIGURATION_CHANGE_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_CONFIGURATION_CHANGE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionConfigurationChangeType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CONFIGURATION_CHANGE_TYPE_VALUES.includes(value)
  );
}

/** Fingerprint algorithm for configuration snapshot (not CORE-21 ownership). */
export const COMPETITION_CONFIGURATION_FINGERPRINT_ALGORITHM = Object.freeze({
  id: "cm04-fnv1a32-v1",
  prefix: "cm04-",
  version: 1,
});

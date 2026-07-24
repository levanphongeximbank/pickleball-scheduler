/**
 * CM-06 publication profile identities.
 *
 * A single explicit profile exists in this phase: CM06_STANDARD_V1.
 * There is no hidden default — commands must pass `publicationProfileId`
 * explicitly and unknown/missing values are rejected.
 */

export const COMPETITION_PUBLICATION_PROFILE_ID = Object.freeze({
  CM06_STANDARD_V1: "CM06_STANDARD_V1",
});

export const COMPETITION_PUBLICATION_PROFILE_ID_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_PROFILE_ID)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationProfileId(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_PROFILE_ID_VALUES.includes(value)
  );
}

/**
 * Explicit presence marker for the optional CM-04 configuration source.
 * Absence must always be explicit — never inferred from `configuration == null`
 * alone without the caller declaring intent.
 */
export const COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE = Object.freeze({
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
});

export const COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationConfigurationPresence(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE_VALUES.includes(value)
  );
}

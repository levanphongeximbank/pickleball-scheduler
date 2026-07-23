/**
 * Player Rating current-state read-model source classifications (Phase 1C).
 * Classification only — does not select a runtime SSOT.
 */

export const PLAYER_RATING_SOURCE_TYPE = Object.freeze({
  PICK_VN_V2: "PICK_VN_V2",
  PICK_VN_V5: "PICK_VN_V5",
  LEGACY_ASSESSMENT: "LEGACY_ASSESSMENT",
  LEGACY_PLAYER_FIELD: "LEGACY_PLAYER_FIELD",
  COMPETITION_ELO_SIGNAL: "COMPETITION_ELO_SIGNAL",
  CLUB_RATING_MIRROR: "CLUB_RATING_MIRROR",
  UNKNOWN: "UNKNOWN",
});

export const PLAYER_RATING_SOURCE_SCALE = Object.freeze({
  PICK_VN_V2_1_0_TO_8_0: "PICK_VN_V2_1_0_TO_8_0",
  PICK_VN_V5_1_5_TO_6_0: "PICK_VN_V5_1_5_TO_6_0",
  COMPETITION_ELO_APPROX_1500: "COMPETITION_ELO_APPROX_1500",
  CLUB_ELO_APPROX_1500: "CLUB_ELO_APPROX_1500",
  UNKNOWN: "UNKNOWN",
});

export const PLAYER_ID_RESOLUTION_STATUS = Object.freeze({
  RESOLVED: "RESOLVED",
  UNRESOLVED: "UNRESOLVED",
  ALIAS_ONLY: "ALIAS_ONLY",
});

export const CONFIDENCE_SCALE = Object.freeze({
  UNIT_0_1: "UNIT_0_1",
  PERCENT_0_100: "PERCENT_0_100",
  UNKNOWN: "UNKNOWN",
});

/** Source types Phase 1C may normalize into public Player Rating candidates. */
export const NORMALIZABLE_SOURCE_TYPES = Object.freeze([
  PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
  PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
  PLAYER_RATING_SOURCE_TYPE.LEGACY_ASSESSMENT,
  PLAYER_RATING_SOURCE_TYPE.LEGACY_PLAYER_FIELD,
]);

/** Classifiable but never treated as public Player Rating authority. */
export const NON_AUTHORITATIVE_SOURCE_TYPES = Object.freeze([
  PLAYER_RATING_SOURCE_TYPE.COMPETITION_ELO_SIGNAL,
  PLAYER_RATING_SOURCE_TYPE.CLUB_RATING_MIRROR,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isKnownPlayerRatingSourceType(value) {
  return Object.values(PLAYER_RATING_SOURCE_TYPE).includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNormalizableSourceType(value) {
  return NORMALIZABLE_SOURCE_TYPES.includes(/** @type {string} */ (value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonAuthoritativeSourceType(value) {
  return NON_AUTHORITATIVE_SOURCE_TYPES.includes(/** @type {string} */ (value));
}

/**
 * Canonical club channel kinds (COMMS-03).
 * Conversation type remains CLUB; kind is channel taxonomy metadata.
 */

export const CLUB_CHANNEL_KIND = Object.freeze({
  GENERAL: "GENERAL",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  PRIVATE: "PRIVATE",
  TEAM: "TEAM",
  MANAGEMENT: "MANAGEMENT",
});

export const CLUB_CHANNEL_KIND_VALUES = Object.freeze(
  Object.values(CLUB_CHANNEL_KIND)
);

/** Default channels resolved deterministically per club. */
export const DEFAULT_CLUB_CHANNEL_KINDS = Object.freeze([
  CLUB_CHANNEL_KIND.GENERAL,
  CLUB_CHANNEL_KIND.ANNOUNCEMENT,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClubChannelKind(value) {
  return CLUB_CHANNEL_KIND_VALUES.includes(/** @type {string} */ (value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDefaultClubChannelKind(value) {
  return DEFAULT_CLUB_CHANNEL_KINDS.includes(/** @type {string} */ (value));
}

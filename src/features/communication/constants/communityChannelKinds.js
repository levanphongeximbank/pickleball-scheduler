/**
 * Canonical community channel kinds (COMMS-04).
 * Conversation type remains COMMUNITY; kind is channel taxonomy metadata.
 */

export const COMMUNITY_CHANNEL_KIND = Object.freeze({
  LOBBY: "LOBBY",
  TOPIC: "TOPIC",
  REGION: "REGION",
  SUPPORT: "SUPPORT",
});

export const COMMUNITY_CHANNEL_KIND_VALUES = Object.freeze(
  Object.values(COMMUNITY_CHANNEL_KIND)
);

/** Default lobby resolves deterministically per tenant. */
export const DEFAULT_COMMUNITY_CHANNEL_KINDS = Object.freeze([
  COMMUNITY_CHANNEL_KIND.LOBBY,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCommunityChannelKind(value) {
  return COMMUNITY_CHANNEL_KIND_VALUES.includes(/** @type {string} */ (value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDefaultCommunityChannelKind(value) {
  return DEFAULT_COMMUNITY_CHANNEL_KINDS.includes(/** @type {string} */ (value));
}

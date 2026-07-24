/**
 * Canonical conversation taxonomy (COMMS-00 locked).
 * DIRECT | CLUB | COMMUNITY | SYSTEM
 */

export const CONVERSATION_TYPE = Object.freeze({
  DIRECT: "DIRECT",
  CLUB: "CLUB",
  COMMUNITY: "COMMUNITY",
  SYSTEM: "SYSTEM",
});

export const CONVERSATION_TYPE_VALUES = Object.freeze(
  Object.values(CONVERSATION_TYPE)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isConversationType(value) {
  return CONVERSATION_TYPE_VALUES.includes(/** @type {string} */ (value));
}

/**
 * Chat moderation action types (Communication-owned interim policy surface).
 */

export const MODERATION_ACTION_TYPE = Object.freeze({
  MUTE_PARTICIPANT: "MUTE_PARTICIPANT",
  REMOVE_PARTICIPANT: "REMOVE_PARTICIPANT",
  RESTRICT_PARTICIPANT: "RESTRICT_PARTICIPANT",
  REMOVE_MESSAGE: "REMOVE_MESSAGE",
});

export const MODERATION_ACTION_TYPE_VALUES = Object.freeze(
  Object.values(MODERATION_ACTION_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isModerationActionType(value) {
  return MODERATION_ACTION_TYPE_VALUES.includes(/** @type {string} */ (value));
}

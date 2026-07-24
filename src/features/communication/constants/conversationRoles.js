/**
 * Roles scoped to a conversation (not Identity RBAC, not Club governance).
 */

export const CONVERSATION_ROLE = Object.freeze({
  MEMBER: "MEMBER",
  MODERATOR: "MODERATOR",
  OWNER: "OWNER",
});

export const CONVERSATION_ROLE_VALUES = Object.freeze(
  Object.values(CONVERSATION_ROLE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConversationRole(value) {
  return CONVERSATION_ROLE_VALUES.includes(/** @type {string} */ (value));
}

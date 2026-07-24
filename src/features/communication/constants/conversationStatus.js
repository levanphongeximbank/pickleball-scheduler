/**
 * Conversation lifecycle / status (COMMS-01 foundation).
 *
 * ACTIVE → ARCHIVED | CLOSED
 * ARCHIVED → ACTIVE | CLOSED
 * CLOSED → (terminal)
 */

export const CONVERSATION_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  CLOSED: "CLOSED",
});

export const CONVERSATION_STATUS_VALUES = Object.freeze(
  Object.values(CONVERSATION_STATUS)
);

export const CONVERSATION_TERMINAL_STATUSES = Object.freeze([
  CONVERSATION_STATUS.CLOSED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const CONVERSATION_ALLOWED_TRANSITIONS = Object.freeze({
  [CONVERSATION_STATUS.ACTIVE]: Object.freeze([
    CONVERSATION_STATUS.ARCHIVED,
    CONVERSATION_STATUS.CLOSED,
  ]),
  [CONVERSATION_STATUS.ARCHIVED]: Object.freeze([
    CONVERSATION_STATUS.ACTIVE,
    CONVERSATION_STATUS.CLOSED,
  ]),
  [CONVERSATION_STATUS.CLOSED]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConversationStatus(value) {
  return CONVERSATION_STATUS_VALUES.includes(/** @type {string} */ (value));
}

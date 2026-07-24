/**
 * Direct conversation request lifecycle (COMMS-02).
 *
 * PENDING → ACCEPTED | DECLINED | CANCELLED | EXPIRED
 * Terminal states do not transition again.
 *
 * EXPIRED is reserved for a future clock/persistence-backed expiry path;
 * COMMS-02 does not auto-expire at runtime (deferred — see docs).
 */

export const CONVERSATION_REQUEST_STATUS = Object.freeze({
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
});

export const CONVERSATION_REQUEST_STATUS_VALUES = Object.freeze(
  Object.values(CONVERSATION_REQUEST_STATUS)
);

export const CONVERSATION_REQUEST_TERMINAL_STATUSES = Object.freeze([
  CONVERSATION_REQUEST_STATUS.ACCEPTED,
  CONVERSATION_REQUEST_STATUS.DECLINED,
  CONVERSATION_REQUEST_STATUS.CANCELLED,
  CONVERSATION_REQUEST_STATUS.EXPIRED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const CONVERSATION_REQUEST_ALLOWED_TRANSITIONS = Object.freeze({
  [CONVERSATION_REQUEST_STATUS.PENDING]: Object.freeze([
    CONVERSATION_REQUEST_STATUS.ACCEPTED,
    CONVERSATION_REQUEST_STATUS.DECLINED,
    CONVERSATION_REQUEST_STATUS.CANCELLED,
    CONVERSATION_REQUEST_STATUS.EXPIRED,
  ]),
  [CONVERSATION_REQUEST_STATUS.ACCEPTED]: Object.freeze([]),
  [CONVERSATION_REQUEST_STATUS.DECLINED]: Object.freeze([]),
  [CONVERSATION_REQUEST_STATUS.CANCELLED]: Object.freeze([]),
  [CONVERSATION_REQUEST_STATUS.EXPIRED]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConversationRequestStatus(value) {
  return CONVERSATION_REQUEST_STATUS_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * Message lifecycle / status (COMMS-01 foundation).
 *
 * VISIBLE → EDITED | DELETED
 * EDITED → EDITED | DELETED
 * DELETED → (terminal tombstone)
 */

export const MESSAGE_STATUS = Object.freeze({
  VISIBLE: "VISIBLE",
  EDITED: "EDITED",
  DELETED: "DELETED",
});

export const MESSAGE_STATUS_VALUES = Object.freeze(
  Object.values(MESSAGE_STATUS)
);

export const MESSAGE_TERMINAL_STATUSES = Object.freeze([
  MESSAGE_STATUS.DELETED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const MESSAGE_ALLOWED_TRANSITIONS = Object.freeze({
  [MESSAGE_STATUS.VISIBLE]: Object.freeze([
    MESSAGE_STATUS.EDITED,
    MESSAGE_STATUS.DELETED,
  ]),
  [MESSAGE_STATUS.EDITED]: Object.freeze([
    MESSAGE_STATUS.EDITED,
    MESSAGE_STATUS.DELETED,
  ]),
  [MESSAGE_STATUS.DELETED]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMessageStatus(value) {
  return MESSAGE_STATUS_VALUES.includes(/** @type {string} */ (value));
}

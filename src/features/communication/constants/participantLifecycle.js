/**
 * Conversation participant lifecycle (membership inside a conversation).
 *
 * ACTIVE → MUTED | SUSPENDED | REMOVED
 * MUTED → ACTIVE | SUSPENDED | REMOVED
 * SUSPENDED → ACTIVE | REMOVED
 * REMOVED → (terminal)
 */

export const PARTICIPANT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  MUTED: "MUTED",
  SUSPENDED: "SUSPENDED",
  REMOVED: "REMOVED",
});

export const PARTICIPANT_STATUS_VALUES = Object.freeze(
  Object.values(PARTICIPANT_STATUS)
);

export const PARTICIPANT_TERMINAL_STATUSES = Object.freeze([
  PARTICIPANT_STATUS.REMOVED,
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const PARTICIPANT_ALLOWED_TRANSITIONS = Object.freeze({
  [PARTICIPANT_STATUS.ACTIVE]: Object.freeze([
    PARTICIPANT_STATUS.MUTED,
    PARTICIPANT_STATUS.SUSPENDED,
    PARTICIPANT_STATUS.REMOVED,
  ]),
  [PARTICIPANT_STATUS.MUTED]: Object.freeze([
    PARTICIPANT_STATUS.ACTIVE,
    PARTICIPANT_STATUS.SUSPENDED,
    PARTICIPANT_STATUS.REMOVED,
  ]),
  [PARTICIPANT_STATUS.SUSPENDED]: Object.freeze([
    PARTICIPANT_STATUS.ACTIVE,
    PARTICIPANT_STATUS.REMOVED,
  ]),
  [PARTICIPANT_STATUS.REMOVED]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isParticipantStatus(value) {
  return PARTICIPANT_STATUS_VALUES.includes(/** @type {string} */ (value));
}

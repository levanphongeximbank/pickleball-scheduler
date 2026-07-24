/**
 * Direct messaging access decisions (COMMS-02).
 * Block always wins → DENY. External social/club policy arrives via port.
 */

export const DIRECT_MESSAGING_ACCESS_DECISION = Object.freeze({
  ALLOW: "ALLOW",
  REQUEST_REQUIRED: "REQUEST_REQUIRED",
  DENY: "DENY",
});

export const DIRECT_MESSAGING_ACCESS_DECISION_VALUES = Object.freeze(
  Object.values(DIRECT_MESSAGING_ACCESS_DECISION)
);

export const DIRECT_MESSAGING_DENY_REASON = Object.freeze({
  SELF_CONVERSATION: "SELF_CONVERSATION",
  DUPLICATE_PARTICIPANT: "DUPLICATE_PARTICIPANT",
  INVALID_IDENTITY: "INVALID_IDENTITY",
  INACTIVE_IDENTITY: "INACTIVE_IDENTITY",
  BLOCKED: "BLOCKED",
  POLICY_DENIED: "POLICY_DENIED",
});

export const DIRECT_MESSAGING_DENY_REASON_VALUES = Object.freeze(
  Object.values(DIRECT_MESSAGING_DENY_REASON)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDirectMessagingAccessDecision(value) {
  return DIRECT_MESSAGING_ACCESS_DECISION_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDirectMessagingDenyReason(value) {
  return DIRECT_MESSAGING_DENY_REASON_VALUES.includes(
    /** @type {string} */ (value)
  );
}

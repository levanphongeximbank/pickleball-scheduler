/**
 * Club Communication access decisions and reason codes (COMMS-03).
 * Policy ports supply decisions; Communication does not hard-code Club roles.
 */

export const CLUB_COMMUNICATION_ACCESS_DECISION = Object.freeze({
  ALLOW: "ALLOW",
  DENY: "DENY",
});

export const CLUB_COMMUNICATION_ACCESS_DECISION_VALUES = Object.freeze(
  Object.values(CLUB_COMMUNICATION_ACCESS_DECISION)
);

export const CLUB_COMMUNICATION_ACCESS_ACTION = Object.freeze({
  JOIN: "JOIN",
  READ: "READ",
  SEND: "SEND",
  ADMIN: "ADMIN",
  PIN: "PIN",
});

export const CLUB_COMMUNICATION_ACCESS_ACTION_VALUES = Object.freeze(
  Object.values(CLUB_COMMUNICATION_ACCESS_ACTION)
);

export const CLUB_COMMUNICATION_DENY_REASON = Object.freeze({
  NOT_MEMBER: "NOT_MEMBER",
  MEMBERSHIP_SUSPENDED: "MEMBERSHIP_SUSPENDED",
  MEMBERSHIP_REMOVED: "MEMBERSHIP_REMOVED",
  CHANNEL_KIND_INVALID: "CHANNEL_KIND_INVALID",
  CHANNEL_ARCHIVED: "CHANNEL_ARCHIVED",
  NOT_EXPLICIT_PARTICIPANT: "NOT_EXPLICIT_PARTICIPANT",
  ANNOUNCEMENT_SEND_DENIED: "ANNOUNCEMENT_SEND_DENIED",
  TEAM_POLICY_DENIED: "TEAM_POLICY_DENIED",
  MANAGEMENT_POLICY_DENIED: "MANAGEMENT_POLICY_DENIED",
  POLICY_DENIED: "POLICY_DENIED",
  INACTIVE_PARTICIPANT: "INACTIVE_PARTICIPANT",
  UNAUTHORIZED_ADMIN: "UNAUTHORIZED_ADMIN",
  PARTICIPANT_CLUB_MISMATCH: "PARTICIPANT_CLUB_MISMATCH",
});

export const CLUB_COMMUNICATION_DENY_REASON_VALUES = Object.freeze(
  Object.values(CLUB_COMMUNICATION_DENY_REASON)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClubCommunicationAccessDecision(value) {
  return CLUB_COMMUNICATION_ACCESS_DECISION_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClubCommunicationAccessAction(value) {
  return CLUB_COMMUNICATION_ACCESS_ACTION_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClubCommunicationDenyReason(value) {
  return CLUB_COMMUNICATION_DENY_REASON_VALUES.includes(
    /** @type {string} */ (value)
  );
}

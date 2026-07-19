/**
 * Canonical lifecycle status enums for participant domain (Phase 2B.2).
 */

export const COMPETITION_PARTICIPANT_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  WITHDRAWN: "WITHDRAWN",
  DISQUALIFIED: "DISQUALIFIED",
  COMPLETED: "COMPLETED",
});

export const COMPETITION_PARTICIPANT_STATUS_VALUES = new Set(
  Object.values(COMPETITION_PARTICIPANT_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionParticipantStatus(value) {
  return typeof value === "string" && COMPETITION_PARTICIPANT_STATUS_VALUES.has(value);
}

export const COMPETITION_REGISTRATION_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  PENDING: "PENDING",
  WAITLISTED: "WAITLISTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
  CANCELLED: "CANCELLED",
});

export const COMPETITION_REGISTRATION_STATUS_VALUES = new Set(
  Object.values(COMPETITION_REGISTRATION_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionRegistrationStatus(value) {
  return typeof value === "string" && COMPETITION_REGISTRATION_STATUS_VALUES.has(value);
}

export const COMPETITION_ENTRY_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  WITHDRAWN: "WITHDRAWN",
  DISQUALIFIED: "DISQUALIFIED",
  COMPLETED: "COMPLETED",
});

export const COMPETITION_ENTRY_STATUS_VALUES = new Set(
  Object.values(COMPETITION_ENTRY_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionEntryStatus(value) {
  return typeof value === "string" && COMPETITION_ENTRY_STATUS_VALUES.has(value);
}

/** Active entry statuses subject to OD-02 uniqueness. */
export const ACTIVE_ENTRY_STATUSES = Object.freeze([
  COMPETITION_ENTRY_STATUS.APPROVED,
  COMPETITION_ENTRY_STATUS.ACTIVE,
]);

/**
 * Terminal / inactive Entry statuses — never treated as active (Core-02).
 * WAITLISTED is Registration-owned (OD-10) and is intentionally absent here.
 */
export const TERMINAL_ENTRY_STATUSES = Object.freeze([
  COMPETITION_ENTRY_STATUS.WITHDRAWN,
  COMPETITION_ENTRY_STATUS.DISQUALIFIED,
  COMPETITION_ENTRY_STATUS.COMPLETED,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isActiveCompetitionEntryStatus(value) {
  return typeof value === "string" && ACTIVE_ENTRY_STATUSES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTerminalCompetitionEntryStatus(value) {
  return typeof value === "string" && TERMINAL_ENTRY_STATUSES.includes(value);
}

export const ELIGIBILITY_DECISION_STATUS = Object.freeze({
  PENDING: "PENDING",
  ELIGIBLE: "ELIGIBLE",
  INELIGIBLE: "INELIGIBLE",
  REQUIRES_REVIEW: "REQUIRES_REVIEW",
  OVERRIDDEN: "OVERRIDDEN",
});

export const ELIGIBILITY_DECISION_STATUS_VALUES = new Set(
  Object.values(ELIGIBILITY_DECISION_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEligibilityDecisionStatus(value) {
  return typeof value === "string" && ELIGIBILITY_DECISION_STATUS_VALUES.has(value);
}

export const COMPETITION_ROSTER_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  ROSTER_LOCKED: "ROSTER_LOCKED",
  AMENDED: "AMENDED",
  WITHDRAWN: "WITHDRAWN",
});

export const COMPETITION_ROSTER_STATUS_VALUES = new Set(
  Object.values(COMPETITION_ROSTER_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionRosterStatus(value) {
  return typeof value === "string" && COMPETITION_ROSTER_STATUS_VALUES.has(value);
}

export const COMPETITION_ROSTER_MEMBER_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  ABSENT: "ABSENT",
  REPLACED: "REPLACED",
  WITHDRAWN: "WITHDRAWN",
});

export const COMPETITION_ROSTER_MEMBER_STATUS_VALUES = new Set(
  Object.values(COMPETITION_ROSTER_MEMBER_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionRosterMemberStatus(value) {
  return typeof value === "string" && COMPETITION_ROSTER_MEMBER_STATUS_VALUES.has(value);
}

export const COMPETITION_LINEUP_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  LOCKED: "LOCKED",
  PUBLISHED: "PUBLISHED",
  SUPERSEDED: "SUPERSEDED",
  VOIDED: "VOIDED",
});

export const COMPETITION_LINEUP_STATUS_VALUES = new Set(
  Object.values(COMPETITION_LINEUP_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLineupStatus(value) {
  return typeof value === "string" && COMPETITION_LINEUP_STATUS_VALUES.has(value);
}

export const COMPETITION_TEAM_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  WITHDRAWN: "WITHDRAWN",
  DISQUALIFIED: "DISQUALIFIED",
  COMPLETED: "COMPLETED",
});

export const COMPETITION_TEAM_STATUS_VALUES = new Set(
  Object.values(COMPETITION_TEAM_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionTeamStatus(value) {
  return typeof value === "string" && COMPETITION_TEAM_STATUS_VALUES.has(value);
}

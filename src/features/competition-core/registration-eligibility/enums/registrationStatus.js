/**
 * Core-03 — Competition registration lifecycle statuses.
 * Local SSOT for registration workflow. Does not mutate Core-02 participant enums.
 */

export const REGISTRATION_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  CONDITIONAL: "CONDITIONAL",
  WAITLISTED: "WAITLISTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
});

/** @type {ReadonlySet<string>} */
export const REGISTRATION_STATUS_VALUES = new Set(Object.values(REGISTRATION_STATUS));

/** Terminal statuses — fail closed on reopen. */
export const TERMINAL_REGISTRATION_STATUSES = Object.freeze([
  REGISTRATION_STATUS.APPROVED,
  REGISTRATION_STATUS.REJECTED,
  REGISTRATION_STATUS.WITHDRAWN,
  REGISTRATION_STATUS.CANCELLED,
  REGISTRATION_STATUS.EXPIRED,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationStatus(value) {
  return typeof value === "string" && REGISTRATION_STATUS_VALUES.has(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTerminalRegistrationStatus(value) {
  return typeof value === "string" && TERMINAL_REGISTRATION_STATUSES.includes(value);
}

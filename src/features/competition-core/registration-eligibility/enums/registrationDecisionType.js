/**
 * Core-03 — human / system decision outcomes on a registration application.
 */

export const REGISTRATION_DECISION_TYPE = Object.freeze({
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  CONDITIONAL_APPROVE: "CONDITIONAL_APPROVE",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  WAITLIST: "WAITLIST",
  WITHDRAW: "WITHDRAW",
  CANCEL: "CANCEL",
  EXPIRE: "EXPIRE",
});

/** @type {ReadonlySet<string>} */
export const REGISTRATION_DECISION_TYPE_VALUES = new Set(
  Object.values(REGISTRATION_DECISION_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationDecisionType(value) {
  return typeof value === "string" && REGISTRATION_DECISION_TYPE_VALUES.has(value);
}

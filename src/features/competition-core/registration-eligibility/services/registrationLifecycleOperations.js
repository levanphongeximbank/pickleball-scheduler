/** Phase 1B lifecycle operation identifiers (audit + service result). */
export const REGISTRATION_LIFECYCLE_OPERATION = Object.freeze({
  CREATE_DRAFT: "CREATE_DRAFT",
  SUBMIT: "SUBMIT",
  BEGIN_REVIEW: "BEGIN_REVIEW",
  WITHDRAW: "WITHDRAW",
  CANCEL: "CANCEL",
  EXPIRE: "EXPIRE",
});

/** @type {ReadonlySet<string>} */
export const REGISTRATION_LIFECYCLE_OPERATION_VALUES = new Set(
  Object.values(REGISTRATION_LIFECYCLE_OPERATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationLifecycleOperation(value) {
  return typeof value === "string" && REGISTRATION_LIFECYCLE_OPERATION_VALUES.has(value);
}

/** System actor id for expiration and other automated transitions. */
export const REGISTRATION_LIFECYCLE_SYSTEM_ACTOR = "system:registration-lifecycle";

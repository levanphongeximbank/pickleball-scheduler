/**
 * CORE-23 — recovery modes, eligibility, partial-operation, outcome kinds.
 */

export const RECOVERY_MODE = Object.freeze({
  RETRY: "RETRY",
  RESUME: "RESUME",
  REPLAY: "REPLAY",
  ROLLBACK: "ROLLBACK",
  MANUAL_RECOVERY: "MANUAL_RECOVERY",
});

/** @type {ReadonlySet<string>} */
export const RECOVERY_MODE_VALUES = new Set(Object.values(RECOVERY_MODE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoveryMode(value) {
  return typeof value === "string" && RECOVERY_MODE_VALUES.has(value);
}

export const RECOVERY_ELIGIBILITY = Object.freeze({
  ELIGIBLE: "ELIGIBLE",
  INELIGIBLE: "INELIGIBLE",
  MANUAL_REQUIRED: "MANUAL_REQUIRED",
  ALREADY_COMPLETED: "ALREADY_COMPLETED",
  DUPLICATE_NOOP: "DUPLICATE_NOOP",
});

/** @type {ReadonlySet<string>} */
export const RECOVERY_ELIGIBILITY_VALUES = new Set(
  Object.values(RECOVERY_ELIGIBILITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoveryEligibility(value) {
  return typeof value === "string" && RECOVERY_ELIGIBILITY_VALUES.has(value);
}

export const PARTIAL_OPERATION_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  VALIDATED_NO_EFFECTS: "VALIDATED_NO_EFFECTS",
  PARTIAL_EFFECTS_APPLIED: "PARTIAL_EFFECTS_APPLIED",
  COMPLETED: "COMPLETED",
  OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN",
  AMBIGUOUS: "AMBIGUOUS",
});

/** @type {ReadonlySet<string>} */
export const PARTIAL_OPERATION_STATUS_VALUES = new Set(
  Object.values(PARTIAL_OPERATION_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPartialOperationStatus(value) {
  return (
    typeof value === "string" && PARTIAL_OPERATION_STATUS_VALUES.has(value)
  );
}

export const RECOVERY_OUTCOME_KIND = Object.freeze({
  ALLOWED: "ALLOWED",
  REJECTED: "REJECTED",
  MANUAL_INTERVENTION: "MANUAL_INTERVENTION",
  DUPLICATE_NOOP: "DUPLICATE_NOOP",
  UNSUPPORTED: "UNSUPPORTED",
});

/** @type {ReadonlySet<string>} */
export const RECOVERY_OUTCOME_KIND_VALUES = new Set(
  Object.values(RECOVERY_OUTCOME_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoveryOutcomeKind(value) {
  return typeof value === "string" && RECOVERY_OUTCOME_KIND_VALUES.has(value);
}

export const RECOVERY_STEP_KIND = Object.freeze({
  VALIDATE: "VALIDATE",
  APPLY_PENDING: "APPLY_PENDING",
  RETRY_OPERATION: "RETRY_OPERATION",
  REPLAY_VERIFY: "REPLAY_VERIFY",
  COMPENSATE: "COMPENSATE",
  REQUIRE_OPERATOR: "REQUIRE_OPERATOR",
  NO_OP: "NO_OP",
});

/** @type {ReadonlySet<string>} */
export const RECOVERY_STEP_KIND_VALUES = new Set(
  Object.values(RECOVERY_STEP_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoveryStepKind(value) {
  return typeof value === "string" && RECOVERY_STEP_KIND_VALUES.has(value);
}

/**
 * CORE-23 — typed recovery error taxonomy.
 * Capability-local. Do not reuse WORKFLOW_* / AUDIT_* / DETERMINISTIC_SEED_REPLAY_* /
 * IMPORT_EXPORT_* / MATCH_RUNTIME_* codes.
 */

export const RECOVERY_ERROR_CODE = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_CHECKPOINT: "INVALID_CHECKPOINT",
  CHECKPOINT_MISSING: "CHECKPOINT_MISSING",
  CHECKPOINT_INCOMPLETE: "CHECKPOINT_INCOMPLETE",
  CHECKPOINT_CORRUPT: "CHECKPOINT_CORRUPT",
  CHECKPOINT_STALE: "CHECKPOINT_STALE",
  CHECKPOINT_INTEGRITY_FAILED: "CHECKPOINT_INTEGRITY_FAILED",
  SUBJECT_MISMATCH: "SUBJECT_MISMATCH",
  OPERATION_MISMATCH: "OPERATION_MISMATCH",
  VERSION_MISMATCH: "VERSION_MISMATCH",
  DEPENDENCY_EVIDENCE_MISMATCH: "DEPENDENCY_EVIDENCE_MISMATCH",
  DEPENDENCY_STATE_CHANGED: "DEPENDENCY_STATE_CHANGED",
  IDEMPOTENCY_INVALID: "IDEMPOTENCY_INVALID",
  DUPLICATE_RECOVERY_CONFLICT: "DUPLICATE_RECOVERY_CONFLICT",
  RESUME_TOKEN_REUSED: "RESUME_TOKEN_REUSED",
  RESUME_TOKEN_INVALID: "RESUME_TOKEN_INVALID",
  MODE_NOT_PERMITTED: "MODE_NOT_PERMITTED",
  RETRY_UNSAFE: "RETRY_UNSAFE",
  RESUME_UNSAFE: "RESUME_UNSAFE",
  REPLAY_EVIDENCE_MISSING: "REPLAY_EVIDENCE_MISSING",
  ROLLBACK_UNSUPPORTED: "ROLLBACK_UNSUPPORTED",
  PARTIAL_OPERATION_AMBIGUOUS: "PARTIAL_OPERATION_AMBIGUOUS",
  OPERATION_ALREADY_COMPLETED: "OPERATION_ALREADY_COMPLETED",
  MANUAL_INTERVENTION_REQUIRED: "MANUAL_INTERVENTION_REQUIRED",
  COMPENSATION_CONTRACT_MISSING: "COMPENSATION_CONTRACT_MISSING",
  IN_MEMORY_EVIDENCE_REJECTED: "IN_MEMORY_EVIDENCE_REJECTED",
});

/** @type {ReadonlySet<string>} */
export const RECOVERY_ERROR_CODE_VALUES = new Set(
  Object.values(RECOVERY_ERROR_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoveryErrorCode(value) {
  return typeof value === "string" && RECOVERY_ERROR_CODE_VALUES.has(value);
}

/**
 * Typed CORE-23 contract / validation error.
 */
export class RecoveryError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isRecoveryErrorCode(code)
      ? code
      : RECOVERY_ERROR_CODE.INVALID_REQUEST;
    super(String(message || safeCode));
    this.name = "RecoveryError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is RecoveryError}
 */
export function isRecoveryError(err) {
  return err instanceof RecoveryError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {RecoveryError}
 */
export function createRecoveryError(code, message, details) {
  return new RecoveryError(code, message, details);
}

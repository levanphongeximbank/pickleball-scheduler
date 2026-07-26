/**
 * Typed Court runtime persistence errors (BM-FINAL-COURT-01).
 * Local to court-engine — not added to API_ERROR_CODES unless foundation requires.
 */

export const COURT_RUNTIME_ERROR_CODES = Object.freeze({
  COURT_RUNTIME_AUTHORITY_UNRESOLVED: "COURT_RUNTIME_AUTHORITY_UNRESOLVED",
  COURT_RUNTIME_DURABLE_STORE_UNAVAILABLE: "COURT_RUNTIME_DURABLE_STORE_UNAVAILABLE",
  COURT_RUNTIME_WRITE_FAILED: "COURT_RUNTIME_WRITE_FAILED",
  COURT_RUNTIME_SCOPE_REQUIRED: "COURT_RUNTIME_SCOPE_REQUIRED",
  COURT_RUNTIME_SCOPE_MISMATCH: "COURT_RUNTIME_SCOPE_MISMATCH",
  COURT_RUNTIME_UNAUTHORIZED: "COURT_RUNTIME_UNAUTHORIZED",
  COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT: "COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT",
  COURT_RUNTIME_DUAL_WRITE_FORBIDDEN: "COURT_RUNTIME_DUAL_WRITE_FORBIDDEN",
  COURT_RUNTIME_UNSUPPORTED_DURABLE_COMMAND: "COURT_RUNTIME_UNSUPPORTED_DURABLE_COMMAND",
});

export const COURT_RUNTIME_ERROR_CODE_VALUES = Object.freeze(
  Object.values(COURT_RUNTIME_ERROR_CODES)
);

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 * @returns {{ ok: false, code: string, error: string, details?: object }}
 */
export function createCourtRuntimeError(code, message, details) {
  const normalized = COURT_RUNTIME_ERROR_CODE_VALUES.includes(code)
    ? code
    : COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED;
  const result = {
    ok: false,
    code: normalized,
    error: String(message || "Court runtime error."),
  };
  if (details !== undefined) {
    result.details = details;
  }
  return result;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCourtRuntimeErrorResult(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.ok === false &&
      typeof value.code === "string" &&
      COURT_RUNTIME_ERROR_CODE_VALUES.includes(value.code)
  );
}

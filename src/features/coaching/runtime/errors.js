/**
 * Typed coaching runtime errors (COACHING-04).
 * Distinct from domain CoachingError — used at the UI/runtime boundary.
 */

export const COACHING_RUNTIME_ERROR_CODES = Object.freeze({
  MISSING_SCOPE: "MISSING_SCOPE",
  MISSING_ACTOR: "MISSING_ACTOR",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  DURABLE_UNAVAILABLE: "DURABLE_UNAVAILABLE",
  CONCURRENCY_CONFLICT: "CONCURRENCY_CONFLICT",
  LEGACY_ONLY: "LEGACY_ONLY",
  PLAYER_SELF_SCOPE_BLOCKED: "PLAYER_SELF_SCOPE_BLOCKED",
  UNSUPPORTED_MODE: "UNSUPPORTED_MODE",
});

export const COACHING_RUNTIME_ERROR_CODE_VALUES = Object.freeze(
  Object.values(COACHING_RUNTIME_ERROR_CODES)
);

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 * @returns {{ ok: false, code: string, error: string, details?: object }}
 */
export function createCoachingRuntimeError(code, message, details) {
  const normalized = COACHING_RUNTIME_ERROR_CODE_VALUES.includes(code)
    ? code
    : COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE;
  const result = {
    ok: false,
    code: normalized,
    error: String(message || "Coaching runtime error."),
  };
  if (details !== undefined) result.details = details;
  return result;
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isCoachingRuntimeErrorResult(err) {
  return Boolean(
    err &&
      typeof err === "object" &&
      err.ok === false &&
      typeof err.code === "string" &&
      COACHING_RUNTIME_ERROR_CODE_VALUES.includes(err.code)
  );
}

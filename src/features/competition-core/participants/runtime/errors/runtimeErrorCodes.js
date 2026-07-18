/**
 * Phase 3B — Participant Resolution Runtime error codes.
 * Prefer these over generic Error for business failures.
 */

export const PARTICIPANT_RUNTIME_ERROR_CODE = Object.freeze({
  PARTICIPANT_NOT_FOUND: "PARTICIPANT_NOT_FOUND",
  IDENTITY_COLLISION: "IDENTITY_COLLISION",
  INVALID_PARTICIPANT: "INVALID_PARTICIPANT",
  UNSUPPORTED_SOURCE: "UNSUPPORTED_SOURCE",
  INVALID_MAPPING: "INVALID_MAPPING",
});

/** @type {ReadonlySet<string>} */
export const PARTICIPANT_RUNTIME_ERROR_CODE_VALUES = new Set(
  Object.values(PARTICIPANT_RUNTIME_ERROR_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isParticipantRuntimeErrorCode(value) {
  return typeof value === "string" && PARTICIPANT_RUNTIME_ERROR_CODE_VALUES.has(value);
}

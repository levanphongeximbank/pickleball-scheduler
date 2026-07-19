import {
  PARTICIPANT_RUNTIME_ERROR_CODE,
  isParticipantRuntimeErrorCode,
} from "./runtimeErrorCodes.js";

/**
 * Typed runtime error — never use bare Error for participant resolve failures.
 */
export class ParticipantRuntimeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isParticipantRuntimeErrorCode(code)
      ? code
      : PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT;
    super(String(message || safeCode));
    this.name = "ParticipantRuntimeError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is ParticipantRuntimeError}
 */
export function isParticipantRuntimeError(err) {
  return err instanceof ParticipantRuntimeError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {ParticipantRuntimeError}
 */
export function createParticipantRuntimeError(code, message, details) {
  return new ParticipantRuntimeError(code, message, details);
}

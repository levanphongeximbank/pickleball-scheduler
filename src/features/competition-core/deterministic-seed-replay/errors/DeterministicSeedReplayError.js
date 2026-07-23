import {
  DETERMINISTIC_SEED_REPLAY_ERROR_CODE,
  isDeterministicSeedReplayErrorCode,
} from "./errorCodes.js";

/**
 * Typed CORE-21 contract / primitive error.
 */
export class DeterministicSeedReplayError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isDeterministicSeedReplayErrorCode(code)
      ? code
      : DETERMINISTIC_SEED_REPLAY_ERROR_CODE.NON_DETERMINISTIC_INPUT;
    super(String(message || safeCode));
    this.name = "DeterministicSeedReplayError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is DeterministicSeedReplayError}
 */
export function isDeterministicSeedReplayError(err) {
  return err instanceof DeterministicSeedReplayError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {DeterministicSeedReplayError}
 */
export function createDeterministicSeedReplayError(code, message, details) {
  return new DeterministicSeedReplayError(code, message, details);
}

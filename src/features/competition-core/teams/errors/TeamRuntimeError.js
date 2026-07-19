import {
  TEAM_RUNTIME_ERROR_CODE,
  isTeamRuntimeErrorCode,
} from "./runtimeErrorCodes.js";

/**
 * Typed runtime error — never use bare Error for team/roster resolve failures.
 */
export class TeamRuntimeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isTeamRuntimeErrorCode(code)
      ? code
      : TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM;
    super(String(message || safeCode));
    this.name = "TeamRuntimeError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is TeamRuntimeError}
 */
export function isTeamRuntimeError(err) {
  return err instanceof TeamRuntimeError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {TeamRuntimeError}
 */
export function createTeamRuntimeError(code, message, details) {
  return new TeamRuntimeError(code, message, details);
}

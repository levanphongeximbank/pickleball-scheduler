/**
 * Shared Competition assignment command errors (fail-closed).
 */

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMMAND_ERROR_CODE_VALUES,
} from "./constants.js";

export class CompetitionRefereeAssignmentCommandError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CompetitionRefereeAssignmentCommandError";
    this.code = code;
    this.details = details && typeof details === "object" ? details : {};
  }
}

export function isCompetitionRefereeAssignmentCommandError(err) {
  return (
    err instanceof CompetitionRefereeAssignmentCommandError ||
    (err &&
      typeof err === "object" &&
      err.name === "CompetitionRefereeAssignmentCommandError" &&
      typeof err.code === "string")
  );
}

export function isAssignmentCommandErrorCode(value) {
  return (
    typeof value === "string" &&
    ASSIGNMENT_COMMAND_ERROR_CODE_VALUES.includes(value)
  );
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failAssignmentCommand(code, message, details = {}) {
  throw new CompetitionRefereeAssignmentCommandError(
    code || ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
    message || "Assignment command failed",
    details
  );
}

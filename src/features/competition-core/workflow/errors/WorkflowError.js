import {
  WORKFLOW_ERROR_CODE,
  isWorkflowErrorCode,
} from "./workflowErrorCodes.js";

/**
 * Typed workflow error — never use bare Error for kernel failures.
 */
export class WorkflowError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isWorkflowErrorCode(code)
      ? code
      : WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION;
    super(String(message || safeCode));
    this.name = "WorkflowError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is WorkflowError}
 */
export function isWorkflowError(err) {
  return err instanceof WorkflowError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {WorkflowError}
 */
export function createWorkflowError(code, message, details) {
  return new WorkflowError(code, message, details);
}

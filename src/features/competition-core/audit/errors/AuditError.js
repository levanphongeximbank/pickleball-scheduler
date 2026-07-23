import { AUDIT_ERROR_CODE, isAuditErrorCode } from "./auditErrorCodes.js";

/**
 * Typed competition audit error — never use bare Error for contract failures.
 */
export class AuditError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isAuditErrorCode(code)
      ? code
      : AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT;
    super(String(message || safeCode));
    this.name = "AuditError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is AuditError}
 */
export function isAuditError(err) {
  return err instanceof AuditError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {AuditError}
 */
export function createAuditError(code, message, details) {
  return new AuditError(code, message, details);
}

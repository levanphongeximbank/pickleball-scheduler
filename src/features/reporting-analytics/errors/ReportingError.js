/**
 * Reporting & Analytics — typed domain / application error (REPORTING-01).
 */

import { REPORTING_ERROR_CODE_VALUES } from "./errorCodes.js";

export class ReportingError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "ReportingError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is ReportingError}
 */
export function isReportingError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "ReportingError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isReportingErrorCode(code) {
  return REPORTING_ERROR_CODE_VALUES.includes(String(code));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function throwReportingError(code, message, details) {
  throw new ReportingError(code, message, details);
}

/**
 * Result-style failure helper (CRM pattern).
 * @param {string} code
 * @param {string} error
 * @param {Record<string, unknown>} [details]
 */
export function reportingFailure(code, error, details = {}) {
  return {
    ok: false,
    code: String(code),
    error: String(error || code),
    details: details && typeof details === "object" ? { ...details } : {},
  };
}

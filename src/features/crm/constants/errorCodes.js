/**
 * Canonical CRM error codes (Phase 1B).
 * Persistence-neutral — no HTTP mapping here.
 */

export const CRM_ERROR_CODES = Object.freeze({
  UNAUTHORIZED: "CRM_UNAUTHORIZED",
  FORBIDDEN_SCOPE: "CRM_FORBIDDEN_SCOPE",
  FORBIDDEN_PERMISSION: "CRM_FORBIDDEN_PERMISSION",
  MISSING_ACTOR: "CRM_MISSING_ACTOR",
  MISSING_SCOPE: "CRM_MISSING_SCOPE",
  INVALID_SCOPE: "CRM_INVALID_SCOPE",
  NOT_FOUND: "CRM_NOT_FOUND",
  INVALID_INPUT: "CRM_INVALID_INPUT",
  INVALID_STATUS: "CRM_INVALID_STATUS",
  INVALID_TRANSITION: "CRM_INVALID_TRANSITION",
  CONTACT_UNRESOLVED: "CRM_CONTACT_UNRESOLVED",
  IDEMPOTENCY_CONFLICT: "CRM_IDEMPOTENCY_CONFLICT",
  INVALID_ENVELOPE: "CRM_INVALID_ENVELOPE",
});

export class CrmError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [details]
   */
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "CrmError";
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 * @returns {{ ok: false, code: string, error: string, details?: object }}
 */
export function crmFailure(code, message, details = undefined) {
  const result = { ok: false, code, error: message };
  if (details !== undefined) result.details = details;
  return result;
}

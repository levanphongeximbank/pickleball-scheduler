/** Core-03 registration & eligibility schema / evaluator versions. */
export const REGISTRATION_ELIGIBILITY_SCHEMA_VERSION = "1";

/** Domain evaluator version — recorded on every EligibilityDecision. */
export const ELIGIBILITY_EVALUATOR_VERSION = "core03-eligibility-1.0.0";

/**
 * @typedef {Object} RegistrationAuditMetadata
 * @property {string|null} [createdAt]
 * @property {string|null} [createdBy]
 * @property {string|null} [updatedAt]
 * @property {string|null} [updatedBy]
 * @property {string|null} [decidedAt]
 * @property {string|null} [decidedBy]
 * @property {string|null} [reason]
 */

/**
 * @param {Partial<RegistrationAuditMetadata>|null|undefined} partial
 * @returns {RegistrationAuditMetadata}
 */
export function createAuditMetadata(partial = {}) {
  return {
    createdAt: partial?.createdAt ?? null,
    createdBy: partial?.createdBy ?? null,
    updatedAt: partial?.updatedAt ?? null,
    updatedBy: partial?.updatedBy ?? null,
    decidedAt: partial?.decidedAt ?? null,
    decidedBy: partial?.decidedBy ?? null,
    reason: partial?.reason ?? null,
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Fail closed when a required identifier is missing.
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    throw new TypeError(`Missing required identifier: ${field}`);
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

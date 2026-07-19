import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "./errorCodes.js";

/**
 * @typedef {Object} RegistrationEligibilityIssue
 * @property {string} code
 * @property {string} path
 * @property {string} message
 * @property {'error'|'warning'} [severity]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} RegistrationEligibilityResult
 * @property {boolean} ok
 * @property {RegistrationEligibilityIssue[]} errors
 * @property {RegistrationEligibilityIssue[]} warnings
 * @property {unknown} [value]
 */

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @param {Record<string, unknown>} [metadata]
 * @returns {RegistrationEligibilityIssue}
 */
export function registrationEligibilityError(code, path, message, metadata) {
  return {
    code: String(code || REGISTRATION_ELIGIBILITY_ERROR_CODE.REQUIRED),
    path: String(path || ""),
    message: String(message || ""),
    severity: "error",
    ...(metadata ? { metadata: { ...metadata } } : {}),
  };
}

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @param {Record<string, unknown>} [metadata]
 * @returns {RegistrationEligibilityIssue}
 */
export function registrationEligibilityWarning(code, path, message, metadata) {
  return {
    code: String(code || REGISTRATION_ELIGIBILITY_ERROR_CODE.REQUIRED),
    path: String(path || ""),
    message: String(message || ""),
    severity: "warning",
    ...(metadata ? { metadata: { ...metadata } } : {}),
  };
}

/**
 * @param {unknown} [value]
 * @param {RegistrationEligibilityIssue[]} [warnings]
 * @returns {RegistrationEligibilityResult}
 */
export function registrationEligibilityOk(value, warnings = []) {
  return {
    ok: true,
    errors: [],
    warnings: Array.isArray(warnings) ? warnings.slice() : [],
    ...(value !== undefined ? { value } : {}),
  };
}

/**
 * @param {RegistrationEligibilityIssue[]} errors
 * @param {RegistrationEligibilityIssue[]} [warnings]
 * @returns {RegistrationEligibilityResult}
 */
export function registrationEligibilityFail(errors, warnings = []) {
  return {
    ok: false,
    errors: Array.isArray(errors) ? errors.slice() : [],
    warnings: Array.isArray(warnings) ? warnings.slice() : [],
  };
}

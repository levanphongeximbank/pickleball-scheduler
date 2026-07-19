import { CLASSIFICATION_ERROR_CODE } from "./errorCodes.js";

/**
 * @typedef {Object} ClassificationIssue
 * @property {string} code
 * @property {string} path
 * @property {string} message
 * @property {'error'|'warning'} [severity]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} ClassificationResult
 * @property {boolean} ok
 * @property {ClassificationIssue[]} errors
 * @property {ClassificationIssue[]} warnings
 * @property {unknown} [value]
 */

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @param {Record<string, unknown>} [metadata]
 * @returns {ClassificationIssue}
 */
export function classificationError(code, path, message, metadata) {
  return {
    code: String(code || CLASSIFICATION_ERROR_CODE.REQUIRED),
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
 * @returns {ClassificationIssue}
 */
export function classificationWarning(code, path, message, metadata) {
  return {
    code: String(code || CLASSIFICATION_ERROR_CODE.MAPPING_UNSUPPORTED),
    path: String(path || ""),
    message: String(message || ""),
    severity: "warning",
    ...(metadata ? { metadata: { ...metadata } } : {}),
  };
}

/**
 * @param {unknown} [value]
 * @param {ClassificationIssue[]} [warnings]
 * @returns {ClassificationResult}
 */
export function classificationOk(value, warnings = []) {
  return {
    ok: true,
    errors: [],
    warnings: Array.isArray(warnings) ? warnings.slice() : [],
    ...(value !== undefined ? { value } : {}),
  };
}

/**
 * @param {ClassificationIssue[]} errors
 * @param {ClassificationIssue[]} [warnings]
 * @returns {ClassificationResult}
 */
export function classificationFail(errors, warnings = []) {
  return {
    ok: false,
    errors: Array.isArray(errors) ? errors.slice() : [],
    warnings: Array.isArray(warnings) ? warnings.slice() : [],
  };
}

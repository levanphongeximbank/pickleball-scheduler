/**
 * Field-level validation errors + validation result envelope (CM-04).
 */

import { deepFreeze, compareFieldPath, clonePlain } from "./shared.js";

/**
 * @typedef {Object} CompetitionConfigurationFieldError
 * @property {string} field
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} CompetitionConfigurationExplanation
 * @property {string} summary
 * @property {readonly string[]} reasons
 */

/**
 * @typedef {{
 *   ok: true,
 *   value: *,
 *   explanation?: CompetitionConfigurationExplanation
 * }} CompetitionConfigurationValidationOk
 *
 * @typedef {{
 *   ok: false,
 *   errors: readonly CompetitionConfigurationFieldError[],
 *   explanation: CompetitionConfigurationExplanation
 * }} CompetitionConfigurationValidationFail
 *
 * @typedef {CompetitionConfigurationValidationOk | CompetitionConfigurationValidationFail} CompetitionConfigurationValidationResult
 */

/**
 * @param {string} field
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {Readonly<CompetitionConfigurationFieldError>}
 */
export function createFieldError(field, code, message, details = {}) {
  return deepFreeze({
    field: String(field),
    code: String(code),
    message: String(message),
    details: details && typeof details === "object" ? { ...details } : {},
  });
}

/**
 * @param {CompetitionConfigurationFieldError[]} errors
 * @returns {CompetitionConfigurationFieldError[]}
 */
export function sortFieldErrors(errors) {
  return [...errors].sort((a, b) => {
    const byField = compareFieldPath(a.field, b.field);
    if (byField !== 0) return byField;
    const byCode = String(a.code).localeCompare(String(b.code), "en");
    if (byCode !== 0) return byCode;
    return String(a.message).localeCompare(String(b.message), "en");
  });
}

/**
 * @param {CompetitionConfigurationFieldError[]} errors
 * @param {string} [validSummary]
 * @returns {Readonly<CompetitionConfigurationExplanation>}
 */
export function buildExplanation(
  errors,
  validSummary = "Competition configuration operation is valid."
) {
  const sorted = sortFieldErrors(errors);
  const reasons = sorted.map((e) => `${e.field}: [${e.code}] ${e.message}`);
  const summary =
    sorted.length === 0
      ? validSummary
      : sorted.length === 1
        ? `Competition configuration invalid: ${reasons[0]}`
        : `Competition configuration invalid (${sorted.length} field errors).`;
  return deepFreeze({ summary, reasons });
}

/**
 * @param {*} value
 * @param {CompetitionConfigurationExplanation} [explanation]
 * @returns {Readonly<CompetitionConfigurationValidationOk>}
 */
export function validationOk(value, explanation) {
  /** @type {CompetitionConfigurationValidationOk} */
  const result = { ok: true, value };
  if (explanation) {
    result.explanation = explanation;
  }
  return deepFreeze(result);
}

/**
 * @param {CompetitionConfigurationFieldError[]} errors
 * @returns {Readonly<CompetitionConfigurationValidationFail>}
 */
export function validationFail(errors) {
  const sorted = sortFieldErrors(errors);
  return deepFreeze({
    ok: false,
    errors: sorted,
    explanation: buildExplanation(sorted),
  });
}

/**
 * @param {unknown} result
 * @returns {result is CompetitionConfigurationValidationOk}
 */
export function isValidationOk(result) {
  return Boolean(result) && /** @type {{ ok?: boolean }} */ (result).ok === true;
}

/**
 * @param {unknown} result
 * @returns {result is CompetitionConfigurationValidationFail}
 */
export function isValidationFail(result) {
  return Boolean(result) && /** @type {{ ok?: boolean }} */ (result).ok === false;
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function snapshotInput(value) {
  if (value === null || typeof value !== "object") return value;
  return clonePlain(value);
}

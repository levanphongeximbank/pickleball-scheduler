/**
 * Field-level validation errors + validation result envelope (CM-05).
 */

import { deepFreeze, compareFieldPath, clonePlain } from "./shared.js";

/**
 * @typedef {Object} CompetitionBrandingFieldError
 * @property {string} field
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} CompetitionBrandingExplanation
 * @property {string} summary
 * @property {readonly string[]} reasons
 */

/**
 * @typedef {{
 *   ok: true,
 *   value: *,
 *   explanation?: CompetitionBrandingExplanation
 * }} CompetitionBrandingValidationOk
 *
 * @typedef {{
 *   ok: false,
 *   errors: readonly CompetitionBrandingFieldError[],
 *   explanation: CompetitionBrandingExplanation
 * }} CompetitionBrandingValidationFail
 *
 * @typedef {CompetitionBrandingValidationOk | CompetitionBrandingValidationFail} CompetitionBrandingValidationResult
 */

/**
 * @param {string} field
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {Readonly<CompetitionBrandingFieldError>}
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
 * @param {CompetitionBrandingFieldError[]} errors
 * @returns {CompetitionBrandingFieldError[]}
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
 * @param {CompetitionBrandingFieldError[]} errors
 * @param {string} [validSummary]
 * @returns {Readonly<CompetitionBrandingExplanation>}
 */
export function buildExplanation(
  errors,
  validSummary = "Competition branding operation is valid."
) {
  const sorted = sortFieldErrors(errors);
  const reasons = sorted.map((e) => `${e.field}: [${e.code}] ${e.message}`);
  const summary =
    sorted.length === 0
      ? validSummary
      : sorted.length === 1
        ? `Competition branding invalid: ${reasons[0]}`
        : `Competition branding invalid (${sorted.length} field errors).`;
  return deepFreeze({ summary, reasons });
}

/**
 * @param {*} value
 * @param {CompetitionBrandingExplanation} [explanation]
 * @returns {Readonly<CompetitionBrandingValidationOk>}
 */
export function validationOk(value, explanation) {
  /** @type {CompetitionBrandingValidationOk} */
  const result = { ok: true, value };
  if (explanation) {
    result.explanation = explanation;
  }
  return deepFreeze(result);
}

/**
 * @param {CompetitionBrandingFieldError[]} errors
 * @returns {Readonly<CompetitionBrandingValidationFail>}
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
 * @returns {result is CompetitionBrandingValidationOk}
 */
export function isValidationOk(result) {
  return Boolean(result) && /** @type {{ ok?: boolean }} */ (result).ok === true;
}

/**
 * @param {unknown} result
 * @returns {result is CompetitionBrandingValidationFail}
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

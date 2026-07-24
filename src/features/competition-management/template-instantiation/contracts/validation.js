/**
 * Field-level validation errors + result envelopes (CM-02).
 * Deterministic: field errors sorted by field path; explanations are stable strings.
 */

import { deepFreeze, compareFieldPath, clonePlain } from "./shared.js";

/**
 * @typedef {Object} CompetitionTemplateFieldError
 * @property {string} field
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} CompetitionTemplateExplanation
 * @property {string} summary
 * @property {readonly string[]} reasons
 */

/**
 * @typedef {{
 *   ok: true,
 *   value: *,
 *   explanation?: CompetitionTemplateExplanation
 * }} CompetitionTemplateValidationOk
 *
 * @typedef {{
 *   ok: false,
 *   errors: readonly CompetitionTemplateFieldError[],
 *   explanation: CompetitionTemplateExplanation
 * }} CompetitionTemplateValidationFail
 *
 * @typedef {CompetitionTemplateValidationOk | CompetitionTemplateValidationFail} CompetitionTemplateValidationResult
 */

/**
 * @param {string} field
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {Readonly<CompetitionTemplateFieldError>}
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
 * @param {CompetitionTemplateFieldError[]} errors
 * @returns {CompetitionTemplateFieldError[]}
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
 * @param {CompetitionTemplateFieldError[]} errors
 * @param {string} [validSummary]
 * @returns {Readonly<CompetitionTemplateExplanation>}
 */
export function buildExplanation(
  errors,
  validSummary = "Competition template operation is valid."
) {
  const sorted = sortFieldErrors(errors);
  const reasons = sorted.map((e) => `${e.field}: [${e.code}] ${e.message}`);
  const summary =
    sorted.length === 0
      ? validSummary
      : sorted.length === 1
        ? `Competition template invalid: ${reasons[0]}`
        : `Competition template invalid (${sorted.length} field errors).`;
  return deepFreeze({ summary, reasons });
}

/**
 * @param {*} value
 * @param {CompetitionTemplateExplanation} [explanation]
 * @returns {Readonly<CompetitionTemplateValidationOk>}
 */
export function validationOk(value, explanation) {
  /** @type {CompetitionTemplateValidationOk} */
  const result = { ok: true, value };
  if (explanation) {
    result.explanation = explanation;
  }
  return deepFreeze(result);
}

/**
 * @param {CompetitionTemplateFieldError[]} errors
 * @returns {Readonly<CompetitionTemplateValidationFail>}
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
 * @returns {result is CompetitionTemplateValidationOk}
 */
export function isValidationOk(result) {
  return Boolean(result) && /** @type {{ ok?: boolean }} */ (result).ok === true;
}

/**
 * @param {unknown} result
 * @returns {result is CompetitionTemplateValidationFail}
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

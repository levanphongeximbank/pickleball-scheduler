/**
 * Field-level validation errors + validation result envelope (CM-03).
 */

import { deepFreeze, compareFieldPath, clonePlain } from "./shared.js";

/**
 * @typedef {Object} CompetitionVersionFieldError
 * @property {string} field
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} CompetitionVersionExplanation
 * @property {string} summary
 * @property {readonly string[]} reasons
 */

/**
 * @typedef {{
 *   ok: true,
 *   value: *,
 *   explanation?: CompetitionVersionExplanation
 * }} CompetitionVersionValidationOk
 *
 * @typedef {{
 *   ok: false,
 *   errors: readonly CompetitionVersionFieldError[],
 *   explanation: CompetitionVersionExplanation
 * }} CompetitionVersionValidationFail
 *
 * @typedef {CompetitionVersionValidationOk | CompetitionVersionValidationFail} CompetitionVersionValidationResult
 */

/**
 * @param {string} field
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {Readonly<CompetitionVersionFieldError>}
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
 * @param {CompetitionVersionFieldError[]} errors
 * @returns {CompetitionVersionFieldError[]}
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
 * @param {CompetitionVersionFieldError[]} errors
 * @param {string} [validSummary]
 * @returns {Readonly<CompetitionVersionExplanation>}
 */
export function buildExplanation(
  errors,
  validSummary = "Competition version operation is valid."
) {
  const sorted = sortFieldErrors(errors);
  const reasons = sorted.map((e) => `${e.field}: [${e.code}] ${e.message}`);
  const summary =
    sorted.length === 0
      ? validSummary
      : sorted.length === 1
        ? `Competition version invalid: ${reasons[0]}`
        : `Competition version invalid (${sorted.length} field errors).`;
  return deepFreeze({ summary, reasons });
}

/**
 * @param {*} value
 * @param {CompetitionVersionExplanation} [explanation]
 * @returns {Readonly<CompetitionVersionValidationOk>}
 */
export function validationOk(value, explanation) {
  /** @type {CompetitionVersionValidationOk} */
  const result = { ok: true, value };
  if (explanation) {
    result.explanation = explanation;
  }
  return deepFreeze(result);
}

/**
 * @param {CompetitionVersionFieldError[]} errors
 * @returns {Readonly<CompetitionVersionValidationFail>}
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
 * @returns {result is CompetitionVersionValidationOk}
 */
export function isValidationOk(result) {
  return Boolean(result) && /** @type {{ ok?: boolean }} */ (result).ok === true;
}

/**
 * @param {unknown} result
 * @returns {result is CompetitionVersionValidationFail}
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

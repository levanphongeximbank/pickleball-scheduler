/**
 * Field-level validation errors + validation result envelope (CM-01).
 * Deterministic: field errors sorted by field path; explanations are stable strings.
 */

import { deepFreeze, compareFieldPath, clonePlain } from "./shared.js";

/**
 * @typedef {Object} CompetitionDefinitionFieldError
 * @property {string} field
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} CompetitionDefinitionExplanation
 * @property {string} summary
 * @property {readonly string[]} reasons
 */

/**
 * @typedef {{
 *   ok: true,
 *   value: *,
 *   explanation?: CompetitionDefinitionExplanation
 * }} CompetitionDefinitionValidationOk
 *
 * @typedef {{
 *   ok: false,
 *   errors: readonly CompetitionDefinitionFieldError[],
 *   explanation: CompetitionDefinitionExplanation
 * }} CompetitionDefinitionValidationFail
 *
 * @typedef {CompetitionDefinitionValidationOk | CompetitionDefinitionValidationFail} CompetitionDefinitionValidationResult
 */

/**
 * @param {string} field
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {Readonly<CompetitionDefinitionFieldError>}
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
 * Sort field errors deterministically by field, then code, then message.
 * @param {CompetitionDefinitionFieldError[]} errors
 * @returns {CompetitionDefinitionFieldError[]}
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
 * @param {CompetitionDefinitionFieldError[]} errors
 * @returns {Readonly<CompetitionDefinitionExplanation>}
 */
export function buildExplanation(errors) {
  const sorted = sortFieldErrors(errors);
  const reasons = sorted.map(
    (e) => `${e.field}: [${e.code}] ${e.message}`
  );
  const summary =
    sorted.length === 0
      ? "Competition definition is valid."
      : sorted.length === 1
        ? `Competition definition invalid: ${reasons[0]}`
        : `Competition definition invalid (${sorted.length} field errors).`;
  return deepFreeze({ summary, reasons });
}

/**
 * @param {*} value
 * @param {CompetitionDefinitionExplanation} [explanation]
 * @returns {Readonly<CompetitionDefinitionValidationOk>}
 */
export function validationOk(value, explanation) {
  /** @type {CompetitionDefinitionValidationOk} */
  const result = { ok: true, value };
  if (explanation) {
    result.explanation = explanation;
  }
  return deepFreeze(result);
}

/**
 * @param {CompetitionDefinitionFieldError[]} errors
 * @returns {Readonly<CompetitionDefinitionValidationFail>}
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
 * @returns {result is CompetitionDefinitionValidationOk}
 */
export function isValidationOk(result) {
  return Boolean(result) && /** @type {{ ok?: boolean }} */ (result).ok === true;
}

/**
 * @param {unknown} result
 * @returns {result is CompetitionDefinitionValidationFail}
 */
export function isValidationFail(result) {
  return Boolean(result) && /** @type {{ ok?: boolean }} */ (result).ok === false;
}

/**
 * Shallow-safe clone of input for immutability tests (does not mutate caller).
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function snapshotInput(value) {
  if (value === null || typeof value !== "object") return value;
  return clonePlain(value);
}

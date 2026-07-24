/**
 * Template identity / version reference contracts (CM-02).
 *
 * CM-01 CompetitionDefinition.template remains opaque `{ templateId }`.
 * CM-02 selection/instantiation uses `{ templateId, templateVersion }`.
 */

import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import { deepFreeze, isNonEmptyString, isPositiveInteger } from "./shared.js";

/**
 * @typedef {Object} CompetitionTemplateId
 * @property {string} templateId
 */

/**
 * @typedef {Object} CompetitionTemplateVersionedIdentity
 * @property {string} templateId
 * @property {number} templateVersion
 */

/**
 * @typedef {Object} CompetitionTemplateReference
 * @property {string} templateId
 * @property {number} templateVersion
 */

/**
 * @param {unknown} input
 * @param {string} [field]
 * @returns {{ value?: Readonly<CompetitionTemplateReference>, error?: import("./validation.js").CompetitionTemplateFieldError }}
 */
export function parseTemplateVersionedReference(
  input,
  field = "template"
) {
  if (!input || typeof input !== "object") {
    return {
      error: createFieldError(
        field,
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID,
        "template reference must be an object with templateId and templateVersion",
        {}
      ),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  if (!isNonEmptyString(raw.templateId)) {
    return {
      error: createFieldError(
        `${field}.templateId`,
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID,
        "templateId is required",
        {}
      ),
    };
  }
  if (!isPositiveInteger(raw.templateVersion)) {
    return {
      error: createFieldError(
        `${field}.templateVersion`,
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_VERSION,
        "templateVersion must be an integer >= 1",
        { value: raw.templateVersion }
      ),
    };
  }
  return {
    value: deepFreeze({
      templateId: String(raw.templateId).trim(),
      templateVersion: /** @type {number} */ (raw.templateVersion),
    }),
  };
}

/**
 * Project CM-02 versioned reference → CM-01 opaque definition field.
 * @param {CompetitionTemplateReference} ref
 * @returns {{ templateId: string }}
 */
export function toCm01TemplateReference(ref) {
  return deepFreeze({ templateId: String(ref.templateId).trim() });
}

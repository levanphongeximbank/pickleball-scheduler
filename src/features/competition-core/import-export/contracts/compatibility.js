/**
 * CORE-22 — Compatibility result contract.
 */

import {
  APPLY_ELIGIBLE_COMPATIBILITY_STATUSES,
  COMPATIBILITY_STATUS,
  COMPATIBILITY_STATUS_VALUES,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
  createCompatibilityError,
  createWarning,
} from "../errors.js";
import {
  deepFreezeClone,
  isPlainObject,
  normalizeStringArray,
} from "../utils/helpers.js";

/**
 * Derive applyEligible from status when caller omits it.
 * @param {string} status
 * @returns {boolean}
 */
export function deriveApplyEligible(status) {
  return APPLY_ELIGIBLE_COMPATIBILITY_STATUSES.has(status);
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createCompatibilityResult(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INCOMPATIBLE_PACKAGE,
      "CompatibilityResult must be a plain object",
      {}
    );
  }

  const status = String(
    partial.status ?? COMPATIBILITY_STATUS.INCOMPATIBLE
  ).trim();
  if (!COMPATIBILITY_STATUS_VALUES.has(status)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INCOMPATIBLE_PACKAGE,
      "Unknown compatibility status",
      { status }
    );
  }

  const derived = deriveApplyEligible(status);
  const applyEligible =
    partial.applyEligible == null ? derived : Boolean(partial.applyEligible);

  if (applyEligible !== derived) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INCOMPATIBLE_PACKAGE,
      `applyEligible must be ${derived} for status ${status}`,
      { status, applyEligible, expected: derived }
    );
  }

  const reasons = Array.isArray(partial.reasons)
    ? Object.freeze(partial.reasons.map((r) => String(r)))
    : Object.freeze([]);

  const warnings = Array.isArray(partial.warnings)
    ? Object.freeze(
        partial.warnings.map((w) =>
          typeof w === "string"
            ? createWarning({ code: "COMPATIBILITY_WARNING", message: w })
            : createWarning(/** @type {object} */ (w))
        )
      )
    : Object.freeze([]);

  const requiredAdapters = Array.isArray(partial.requiredAdapters)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.requiredAdapters)
      )
    : Object.freeze([]);

  const unsupportedModules = Array.isArray(partial.unsupportedModules)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.unsupportedModules)
      )
    : Object.freeze([]);

  if (
    status === COMPATIBILITY_STATUS.REQUIRES_ADAPTER &&
    requiredAdapters.length === 0
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INCOMPATIBLE_PACKAGE,
      "REQUIRES_ADAPTER must declare requiredAdapters",
      {}
    );
  }

  if (
    status === COMPATIBILITY_STATUS.MISSING_DEPENDENCY &&
    reasons.length === 0
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MISSING_DEPENDENCY,
      "MISSING_DEPENDENCY must include reasons",
      {}
    );
  }

  const errors = Array.isArray(partial.errors)
    ? Object.freeze(
        partial.errors.map((e) =>
          createCompatibilityError(/** @type {object} */ (e))
        )
      )
    : Object.freeze([]);

  return Object.freeze(
    deepFreezeClone({
      status,
      applyEligible,
      reasons,
      warnings,
      requiredAdapters,
      unsupportedModules,
      errors,
    })
  );
}

export { COMPATIBILITY_STATUS, APPLY_ELIGIBLE_COMPATIBILITY_STATUSES };

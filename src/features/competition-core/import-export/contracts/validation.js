/**
 * CORE-22 — Validation result contract.
 */

import { VALIDATION_STATUS, VALIDATION_STATUS_VALUES } from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
  createFatalError,
  createValidationError,
  createWarning,
  createInformationalDiagnostic,
} from "../errors.js";
import {
  deepFreezeClone,
  isPlainObject,
} from "../utils/helpers.js";

/**
 * @param {unknown} list
 * @param {(item: object) => Readonly<object>} factory
 * @returns {ReadonlyArray<Readonly<object>>}
 */
function normalizeDiagnosticList(list, factory) {
  if (list == null) return Object.freeze([]);
  if (!Array.isArray(list)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Diagnostic list must be an array",
      {}
    );
  }
  return Object.freeze(list.map((item) => factory(/** @type {object} */ (item))));
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createValidationResult(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "ValidationResult must be a plain object",
      {}
    );
  }

  const status = String(partial.status ?? VALIDATION_STATUS.VALID).trim();
  if (!VALIDATION_STATUS_VALUES.has(status)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Unknown validation status",
      { status }
    );
  }

  const fatalErrors = normalizeDiagnosticList(
    partial.fatalErrors,
    createFatalError
  );
  const errors = normalizeDiagnosticList(
    partial.errors,
    createValidationError
  );
  const warnings = normalizeDiagnosticList(partial.warnings, createWarning);
  const infos = normalizeDiagnosticList(
    partial.infos,
    createInformationalDiagnostic
  );

  const hasBlockingErrors = fatalErrors.length > 0 || errors.length > 0;

  if (status === VALIDATION_STATUS.VALID && hasBlockingErrors) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "VALID status cannot include fatal or validation errors",
      {}
    );
  }
  if (
    status === VALIDATION_STATUS.VALID_WITH_WARNINGS &&
    hasBlockingErrors
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "VALID_WITH_WARNINGS cannot include fatal or validation errors",
      {}
    );
  }
  if (status === VALIDATION_STATUS.INVALID && !hasBlockingErrors) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "INVALID status requires at least one fatal or validation error",
      {}
    );
  }

  return Object.freeze(
    deepFreezeClone({
      status,
      valid: status !== VALIDATION_STATUS.INVALID,
      fatalErrors,
      errors,
      warnings,
      infos,
      schemaVersion:
        partial.schemaVersion == null || partial.schemaVersion === ""
          ? null
          : String(partial.schemaVersion).trim(),
      manifestVersion:
        partial.manifestVersion == null
          ? null
          : Number(partial.manifestVersion),
    })
  );
}

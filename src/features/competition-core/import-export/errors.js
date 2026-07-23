/**
 * CORE-22 — typed import/export error taxonomy + diagnostic constructors.
 * Capability-local. Do not reuse AUDIT_* / WORKFLOW_* / DETERMINISTIC_SEED_REPLAY_* codes.
 */

import {
  DIAGNOSTIC_KIND,
  DIAGNOSTIC_KIND_VALUES,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_SEVERITY_VALUES,
} from "./constants.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "./utils/helpers.js";

export const IMPORT_EXPORT_ERROR_CODE = Object.freeze({
  INVALID_PACKAGE: "INVALID_PACKAGE",
  MALFORMED_MANIFEST: "MALFORMED_MANIFEST",
  UNSUPPORTED_MANIFEST_VERSION: "UNSUPPORTED_MANIFEST_VERSION",
  UNSUPPORTED_SCHEMA_VERSION: "UNSUPPORTED_SCHEMA_VERSION",
  UNSUPPORTED_MODULE_VERSION: "UNSUPPORTED_MODULE_VERSION",
  CHECKSUM_MISMATCH: "CHECKSUM_MISMATCH",
  INCOMPATIBLE_PACKAGE: "INCOMPATIBLE_PACKAGE",
  MISSING_DEPENDENCY: "MISSING_DEPENDENCY",
  UNRESOLVED_REFERENCE: "UNRESOLVED_REFERENCE",
  DUPLICATE_ID: "DUPLICATE_ID",
  TARGET_CONFLICT: "TARGET_CONFLICT",
  REDACTION_VIOLATION: "REDACTION_VIOLATION",
  PARTIAL_IMPORT_DENIED: "PARTIAL_IMPORT_DENIED",
  DRY_RUN_REQUIRED: "DRY_RUN_REQUIRED",
  APPLY_PRECONDITION_FAILED: "APPLY_PRECONDITION_FAILED",
  SERIALIZATION_FAILURE: "SERIALIZATION_FAILURE",
  DESERIALIZATION_FAILURE: "DESERIALIZATION_FAILURE",
});

/** @type {ReadonlySet<string>} */
export const IMPORT_EXPORT_ERROR_CODE_VALUES = new Set(
  Object.values(IMPORT_EXPORT_ERROR_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isImportExportErrorCode(value) {
  return (
    typeof value === "string" && IMPORT_EXPORT_ERROR_CODE_VALUES.has(value)
  );
}

/**
 * Typed CORE-22 contract / validation error.
 */
export class ImportExportError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isImportExportErrorCode(code)
      ? code
      : IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE;
    super(String(message || safeCode));
    this.name = "ImportExportError";
    this.code = safeCode;
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is ImportExportError}
 */
export function isImportExportError(err) {
  return err instanceof ImportExportError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {ImportExportError}
 */
export function createImportExportError(code, message, details) {
  return new ImportExportError(code, message, details);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireCode(value, field) {
  if (!isNonEmptyString(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      `${field} must be a non-empty string`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {object} partial
 * @param {string} kind
 * @param {string} defaultSeverity
 * @returns {Readonly<object>}
 */
function createDiagnostic(partial, kind, defaultSeverity) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Diagnostic must be a plain object",
      { kind }
    );
  }
  if (!DIAGNOSTIC_KIND_VALUES.has(kind)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Unknown diagnostic kind",
      { kind }
    );
  }

  const severity =
    partial.severity == null ? defaultSeverity : String(partial.severity).trim();
  if (!DIAGNOSTIC_SEVERITY_VALUES.has(severity)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Unknown diagnostic severity",
      { severity }
    );
  }

  const code = requireCode(partial.code, "code");
  const message = requireCode(partial.message, "message");

  /** @type {Readonly<Record<string, unknown>>|null} */
  let details = null;
  if (partial.details != null) {
    if (!isPlainObject(partial.details)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
        "details must be a plain object when provided",
        { kind }
      );
    }
    details = /** @type {Readonly<Record<string, unknown>>} */ (
      deepFreezeClone(partial.details)
    );
  }

  return Object.freeze({
    kind,
    code,
    message,
    severity,
    fieldPath:
      partial.fieldPath == null || partial.fieldPath === ""
        ? null
        : String(partial.fieldPath).trim(),
    details,
  });
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createFatalError(partial = {}) {
  return createDiagnostic(
    {
      ...partial,
      severity: DIAGNOSTIC_SEVERITY.FATAL,
    },
    DIAGNOSTIC_KIND.FATAL_ERROR,
    DIAGNOSTIC_SEVERITY.FATAL
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createValidationError(partial = {}) {
  return createDiagnostic(
    partial,
    DIAGNOSTIC_KIND.VALIDATION_ERROR,
    DIAGNOSTIC_SEVERITY.ERROR
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createCompatibilityError(partial = {}) {
  return createDiagnostic(
    partial,
    DIAGNOSTIC_KIND.COMPATIBILITY_ERROR,
    DIAGNOSTIC_SEVERITY.ERROR
  );
}

/**
 * Conflict diagnostics are machine-readable conflict records created via
 * createConflictReportEntry. This constructor emits a diagnostic wrapper.
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createConflictDiagnostic(partial = {}) {
  return createDiagnostic(
    partial,
    DIAGNOSTIC_KIND.CONFLICT,
    DIAGNOSTIC_SEVERITY.ERROR
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createWarning(partial = {}) {
  return createDiagnostic(
    partial,
    DIAGNOSTIC_KIND.WARNING,
    DIAGNOSTIC_SEVERITY.WARNING
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createInformationalDiagnostic(partial = {}) {
  return createDiagnostic(
    partial,
    DIAGNOSTIC_KIND.INFO,
    DIAGNOSTIC_SEVERITY.INFO
  );
}

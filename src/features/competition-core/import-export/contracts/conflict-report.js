/**
 * CORE-22 — Machine-readable conflict report contract.
 * No silent overwrite semantics.
 */

import {
  ALWAYS_BLOCKS_APPLY_CONFLICT_TYPES,
  CONFLICT_TYPE,
  CONFLICT_TYPE_VALUES,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_SEVERITY_VALUES,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
  normalizeStringArray,
} from "../utils/helpers.js";

/**
 * @param {string} conflictType
 * @param {string} severity
 * @param {boolean|undefined} blocksApply
 * @returns {boolean}
 */
export function deriveBlocksApply(conflictType, severity, blocksApply) {
  if (ALWAYS_BLOCKS_APPLY_CONFLICT_TYPES.has(conflictType)) {
    return true;
  }
  if (severity === DIAGNOSTIC_SEVERITY.FATAL) {
    return true;
  }
  if (blocksApply == null) {
    return (
      severity === DIAGNOSTIC_SEVERITY.FATAL ||
      severity === DIAGNOSTIC_SEVERITY.ERROR
    );
  }
  return Boolean(blocksApply);
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createConflictReportEntry(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.TARGET_CONFLICT,
      "Conflict entry must be a plain object",
      {}
    );
  }

  const conflictType = String(partial.conflictType ?? "").trim();
  if (!CONFLICT_TYPE_VALUES.has(conflictType)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.TARGET_CONFLICT,
      "Unknown conflictType",
      { conflictType: partial.conflictType }
    );
  }

  const conflictId = isNonEmptyString(partial.conflictId)
    ? String(partial.conflictId).trim()
    : null;
  if (!conflictId) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.TARGET_CONFLICT,
      "conflictId is required",
      {}
    );
  }

  const severity = String(
    partial.severity ??
      (conflictType === CONFLICT_TYPE.INTEGRITY_FAILURE
        ? DIAGNOSTIC_SEVERITY.FATAL
        : DIAGNOSTIC_SEVERITY.ERROR)
  ).trim();
  if (!DIAGNOSTIC_SEVERITY_VALUES.has(severity)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.TARGET_CONFLICT,
      "Unknown conflict severity",
      { severity }
    );
  }

  if (
    conflictType === CONFLICT_TYPE.INTEGRITY_FAILURE &&
    severity !== DIAGNOSTIC_SEVERITY.FATAL
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
      "INTEGRITY_FAILURE severity must be FATAL",
      { severity }
    );
  }

  const blocksApply = deriveBlocksApply(
    conflictType,
    severity,
    /** @type {boolean|undefined} */ (partial.blocksApply)
  );

  if (
    ALWAYS_BLOCKS_APPLY_CONFLICT_TYPES.has(conflictType) &&
    partial.blocksApply === false
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.APPLY_PRECONDITION_FAILED,
      `${conflictType} must set blocksApply=true (no silent overwrite)`,
      { conflictType }
    );
  }

  const resolutionOptions = Array.isArray(partial.resolutionOptions)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.resolutionOptions)
      )
    : Object.freeze([]);

  // Explicit: never imply silent overwrite.
  if (resolutionOptions.includes("SILENT_OVERWRITE")) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.APPLY_PRECONDITION_FAILED,
      "SILENT_OVERWRITE is not a permitted resolution option",
      {}
    );
  }

  return Object.freeze(
    deepFreezeClone({
      conflictId,
      conflictType,
      severity,
      entityType:
        partial.entityType == null || partial.entityType === ""
          ? null
          : String(partial.entityType).trim(),
      sourceReference:
        partial.sourceReference == null || partial.sourceReference === ""
          ? null
          : String(partial.sourceReference).trim(),
      targetReference:
        partial.targetReference == null || partial.targetReference === ""
          ? null
          : String(partial.targetReference).trim(),
      fieldPath:
        partial.fieldPath == null || partial.fieldPath === ""
          ? null
          : String(partial.fieldPath).trim(),
      expected: partial.expected === undefined ? null : partial.expected,
      actual: partial.actual === undefined ? null : partial.actual,
      resolutionOptions,
      selectedResolution:
        partial.selectedResolution == null ||
        partial.selectedResolution === ""
          ? null
          : String(partial.selectedResolution).trim(),
      explanation:
        partial.explanation == null || partial.explanation === ""
          ? null
          : String(partial.explanation),
      blocksApply,
    })
  );
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createConflictReport(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.TARGET_CONFLICT,
      "ConflictReport must be a plain object",
      {}
    );
  }

  const conflicts = Array.isArray(partial.conflicts)
    ? Object.freeze(
        partial.conflicts.map((c) =>
          createConflictReportEntry(/** @type {object} */ (c))
        )
      )
    : Object.freeze([]);

  const blockingCount = conflicts.filter((c) => c.blocksApply).length;

  return Object.freeze(
    deepFreezeClone({
      conflicts,
      blockingCount,
      applyBlocked: blockingCount > 0,
      silentOverwritePermitted: false,
    })
  );
}

export { CONFLICT_TYPE, ALWAYS_BLOCKS_APPLY_CONFLICT_TYPES };

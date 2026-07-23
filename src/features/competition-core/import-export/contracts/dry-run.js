/**
 * CORE-22 — Dry-run result contract.
 *
 * Does not implement import parsing or mutation apply.
 */

import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
  createWarning,
} from "../errors.js";
import {
  isNonEmptyString,
  isPlainObject,
  normalizeCountMap,
  normalizeStringArray,
} from "../utils/helpers.js";
import { createCompatibilityResult } from "./compatibility.js";
import { createConflictReport } from "./conflict-report.js";
import {
  createIdMappingEntry,
  createReferenceMappingEntry,
} from "./reference-mapping.js";
import { createValidationResult } from "./validation.js";

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createDryRunResult(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DRY_RUN_REQUIRED,
      "DryRunResult must be a plain object",
      {}
    );
  }

  const packageFingerprint = isNonEmptyString(partial.packageFingerprint)
    ? String(partial.packageFingerprint).trim()
    : null;
  const targetRevisionFingerprint = isNonEmptyString(
    partial.targetRevisionFingerprint
  )
    ? String(partial.targetRevisionFingerprint).trim()
    : null;
  const importPlanFingerprint = isNonEmptyString(partial.importPlanFingerprint)
    ? String(partial.importPlanFingerprint).trim()
    : null;

  if (!packageFingerprint || !targetRevisionFingerprint || !importPlanFingerprint) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DRY_RUN_REQUIRED,
      "Dry-run requires packageFingerprint, targetRevisionFingerprint, and importPlanFingerprint",
      {}
    );
  }

  const validationResult = createValidationResult(
    partial.validationResult ?? { status: "VALID" }
  );
  const compatibilityResult = createCompatibilityResult(
    partial.compatibilityResult ?? {
      status: "COMPATIBLE",
      applyEligible: true,
    }
  );

  const referenceMappings = Array.isArray(partial.referenceMappings)
    ? Object.freeze(
        partial.referenceMappings.map((r) =>
          createReferenceMappingEntry(/** @type {object} */ (r))
        )
      )
    : Object.freeze([]);

  const idMappings = Array.isArray(partial.idMappings)
    ? Object.freeze(
        partial.idMappings.map((m) =>
          createIdMappingEntry(/** @type {object} */ (m))
        )
      )
    : Object.freeze([]);

  const conflictReport = createConflictReport({
    conflicts: partial.conflicts ?? [],
  });

  const warnings = Array.isArray(partial.warnings)
    ? Object.freeze(
        partial.warnings.map((w) =>
          typeof w === "string"
            ? createWarning({ code: "DRY_RUN_WARNING", message: w })
            : createWarning(/** @type {object} */ (w))
        )
      )
    : Object.freeze([]);

  let itemCounts;
  try {
    itemCounts = normalizeCountMap(partial.itemCounts ?? {}, "itemCounts");
  } catch (err) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DRY_RUN_REQUIRED,
      err instanceof Error ? err.message : "Invalid itemCounts",
      {}
    );
  }

  const selectedModules = Array.isArray(partial.selectedModules)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.selectedModules)
      )
    : Object.freeze([]);

  const omittedModules = Array.isArray(partial.omittedModules)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.omittedModules)
      )
    : Object.freeze([]);

  const appliedCandidateIds = Array.isArray(partial.appliedCandidateIds)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.appliedCandidateIds)
      )
    : Object.freeze([]);
  const pendingCandidateIds = Array.isArray(partial.pendingCandidateIds)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.pendingCandidateIds)
      )
    : Object.freeze([]);
  const rejectedCandidateIds = Array.isArray(partial.rejectedCandidateIds)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.rejectedCandidateIds)
      )
    : Object.freeze([]);

  const applyEligible =
    partial.applyEligible == null
      ? compatibilityResult.applyEligible &&
        validationResult.valid &&
        !conflictReport.applyBlocked
      : Boolean(partial.applyEligible);

  if (
    applyEligible &&
    (!compatibilityResult.applyEligible ||
      !validationResult.valid ||
      conflictReport.applyBlocked)
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.APPLY_PRECONDITION_FAILED,
      "Dry-run applyEligible cannot be true when validation/compatibility/conflicts block apply",
      {}
    );
  }

  /** @type {Readonly<Record<string, unknown>>|null} */
  let importPlan = null;
  if (partial.importPlan != null) {
    if (!isPlainObject(partial.importPlan)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.DRY_RUN_REQUIRED,
        "importPlan must be a plain object when provided",
        {}
      );
    }
    importPlan = Object.freeze({ ...partial.importPlan });
  }

  // Nested factories already return frozen values. Avoid deepFreezeClone on a
  // graph that intentionally shares conflictReport.conflicts with conflicts.
  return Object.freeze({
    packageFingerprint,
    targetRevisionFingerprint,
    importPlanFingerprint,
    validationResult,
    compatibilityResult,
    referenceMappings,
    idMappings,
    conflicts: conflictReport.conflicts,
    conflictReport,
    warnings,
    itemCounts,
    selectedModules,
    omittedModules,
    appliedCandidateIds,
    pendingCandidateIds,
    rejectedCandidateIds,
    importPlan,
    applyEligible,
    mutationApplied: false,
    parsingExecuted: false,
  });
}

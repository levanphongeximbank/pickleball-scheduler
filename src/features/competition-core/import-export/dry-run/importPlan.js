/**
 * CORE-22 import-plan representation + stale-plan detection (CORE-23 handoff).
 * No checkpoint persistence, resume tokens, or recovery execution.
 */

import { ImportExportError, IMPORT_EXPORT_ERROR_CODE } from "../errors.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/helpers.js";
import { sha256Canonical } from "../integrity/index.js";
import { ADAPTER_REGISTRY_VERSION } from "../adapters/registry.js";

export const IMPORT_PLAN_POLICY_VERSION = "core22.import-policy.v1";
export const IMPORT_PLAN_SCHEMA_VERSION = "core22.import-plan.v1";

/**
 * Stable import-plan representation for CORE-23 handoff.
 *
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createImportPlan(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DRY_RUN_REQUIRED,
      "ImportPlan must be a plain object",
      {}
    );
  }

  const packageFingerprint = requireFp(
    partial.packageFingerprint,
    "packageFingerprint"
  );
  const targetRevisionFingerprint = requireFp(
    partial.targetRevisionFingerprint,
    "targetRevisionFingerprint"
  );
  const selectedModulesFingerprint = requireFp(
    partial.selectedModulesFingerprint,
    "selectedModulesFingerprint"
  );
  const mappingPlanFingerprint = requireFp(
    partial.mappingPlanFingerprint,
    "mappingPlanFingerprint"
  );
  const conflictReportFingerprint = requireFp(
    partial.conflictReportFingerprint,
    "conflictReportFingerprint"
  );

  const adapterRegistryVersion = isNonEmptyString(
    partial.adapterRegistryVersion
  )
    ? String(partial.adapterRegistryVersion).trim()
    : ADAPTER_REGISTRY_VERSION;
  const policyVersion = isNonEmptyString(partial.policyVersion)
    ? String(partial.policyVersion).trim()
    : IMPORT_PLAN_POLICY_VERSION;

  const importPlanFingerprint =
    isNonEmptyString(partial.importPlanFingerprint)
      ? String(partial.importPlanFingerprint).trim()
      : sha256Canonical({
          schemaVersion: IMPORT_PLAN_SCHEMA_VERSION,
          packageFingerprint,
          targetRevisionFingerprint,
          selectedModulesFingerprint,
          adapterRegistryVersion,
          policyVersion,
          mappingPlanFingerprint,
          conflictReportFingerprint,
        });

  return Object.freeze(
    deepFreezeClone({
      schemaVersion: IMPORT_PLAN_SCHEMA_VERSION,
      packageFingerprint,
      targetRevisionFingerprint,
      selectedModulesFingerprint,
      adapterRegistryVersion,
      policyVersion,
      mappingPlanFingerprint,
      conflictReportFingerprint,
      importPlanFingerprint,
      idempotencyReference:
        partial.idempotencyReference == null ||
        partial.idempotencyReference === ""
          ? null
          : String(partial.idempotencyReference).trim(),
      applyEligible: Boolean(partial.applyEligible),
      // Explicit non-ownership of recovery:
      checkpointPersisted: false,
      resumeToken: null,
      recoveryExecutable: false,
    })
  );
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireFp(value, field) {
  if (!isNonEmptyString(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DRY_RUN_REQUIRED,
      `${field} is required for import plan`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * Pure stale-plan check against current context fingerprints.
 *
 * @param {object} plan — previously created import plan
 * @param {object} current
 * @param {string} current.packageFingerprint
 * @param {string} current.targetRevisionFingerprint
 * @param {string} current.selectedModulesFingerprint
 * @param {string} [current.adapterRegistryVersion]
 * @param {string} [current.policyVersion]
 * @param {string} [current.mappingPlanFingerprint]
 * @returns {Readonly<object>}
 */
export function detectStaleImportPlan(plan, current = {}) {
  if (!isPlainObject(plan) || !isPlainObject(current)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DRY_RUN_REQUIRED,
      "detectStaleImportPlan requires plan and current context objects",
      {}
    );
  }

  /** @type {string[]} */
  const reasons = [];

  if (plan.packageFingerprint !== current.packageFingerprint) {
    reasons.push("packageFingerprint changed");
  }
  if (plan.targetRevisionFingerprint !== current.targetRevisionFingerprint) {
    reasons.push("targetRevisionFingerprint changed");
  }
  if (plan.selectedModulesFingerprint !== current.selectedModulesFingerprint) {
    reasons.push("selectedModulesFingerprint changed");
  }
  if (
    current.adapterRegistryVersion != null &&
    plan.adapterRegistryVersion !== current.adapterRegistryVersion
  ) {
    reasons.push("adapterRegistryVersion changed");
  }
  if (
    current.policyVersion != null &&
    plan.policyVersion !== current.policyVersion
  ) {
    reasons.push("policyVersion changed");
  }
  if (
    current.mappingPlanFingerprint != null &&
    plan.mappingPlanFingerprint !== current.mappingPlanFingerprint
  ) {
    reasons.push("mappingPlanFingerprint changed");
  }

  return Object.freeze({
    stale: reasons.length > 0,
    reasons: Object.freeze(reasons),
    planFingerprint: plan.importPlanFingerprint ?? null,
  });
}

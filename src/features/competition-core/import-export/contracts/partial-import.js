/**
 * CORE-22 — Partial import policy contract.
 *
 * v1 supports ALL_OR_NOTHING (default) and SELECTED_MODULES only.
 * Entity-scoped and best-effort import are explicitly unsupported.
 */

import {
  DEFAULT_PARTIAL_IMPORT_POLICY,
  PARTIAL_IMPORT_POLICY,
  PARTIAL_IMPORT_POLICY_VALUES,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  deepFreezeClone,
  isPlainObject,
  normalizeStringArray,
} from "../utils/helpers.js";

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createPartialImportPolicy(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED,
      "PartialImportPolicy must be a plain object",
      {}
    );
  }

  if (partial.entityScoped === true || partial.bestEffort === true) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED,
      "Entity-scoped and best-effort import are unsupported in v1",
      {}
    );
  }

  const policy = String(
    partial.policy ?? DEFAULT_PARTIAL_IMPORT_POLICY
  ).trim();
  if (!PARTIAL_IMPORT_POLICY_VALUES.has(policy)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED,
      "Unknown partial import policy",
      { policy }
    );
  }

  const selectedModules = Array.isArray(partial.selectedModules)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.selectedModules)
      )
    : Object.freeze([]);

  const dependencyClosure = Array.isArray(partial.dependencyClosure)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.dependencyClosure)
      )
    : Object.freeze([]);

  const omittedModules = Array.isArray(partial.omittedModules)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.omittedModules)
      )
    : Object.freeze([]);

  if (policy === PARTIAL_IMPORT_POLICY.ALL_OR_NOTHING) {
    if (selectedModules.length > 0 || omittedModules.length > 0) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED,
        "ALL_OR_NOTHING must not declare selected or omitted modules",
        { policy }
      );
    }
    return Object.freeze(
      deepFreezeClone({
        policy: PARTIAL_IMPORT_POLICY.ALL_OR_NOTHING,
        selectedModules: Object.freeze([]),
        dependencyClosure: Object.freeze([]),
        omittedModules: Object.freeze([]),
        entityScopedSupported: false,
        bestEffortSupported: false,
        requiresDependencyClosure: false,
      })
    );
  }

  // SELECTED_MODULES
  if (selectedModules.length === 0) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED,
      "SELECTED_MODULES requires selectedModules",
      {}
    );
  }
  if (dependencyClosure.length === 0) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED,
      "SELECTED_MODULES must declare dependencyClosure",
      {}
    );
  }

  for (const mod of selectedModules) {
    if (!dependencyClosure.includes(mod)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED,
        "dependencyClosure must include every selected module",
        { module: mod }
      );
    }
  }

  return Object.freeze(
    deepFreezeClone({
      policy: PARTIAL_IMPORT_POLICY.SELECTED_MODULES,
      selectedModules,
      dependencyClosure,
      omittedModules,
      entityScopedSupported: false,
      bestEffortSupported: false,
      requiresDependencyClosure: true,
    })
  );
}

/**
 * @returns {Readonly<object>}
 */
export function createDefaultPartialImportPolicy() {
  return createPartialImportPolicy({
    policy: PARTIAL_IMPORT_POLICY.ALL_OR_NOTHING,
  });
}

export { PARTIAL_IMPORT_POLICY, DEFAULT_PARTIAL_IMPORT_POLICY };

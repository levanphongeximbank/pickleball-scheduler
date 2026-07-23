/**
 * CORE-22 — Competition package representation contract.
 *
 * Owns package shape only. Does not parse bytes, store media, or apply mutations.
 */

import {
  COMPETITION_PACKAGE_SCHEMA_VERSION,
  PACKAGE_TYPE,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/helpers.js";
import { createCompetitionPackageManifest } from "./manifest.js";

/**
 * @typedef {Object} CompetitionPackage
 * @property {string} packageType
 * @property {string} schemaVersion
 * @property {Readonly<object>} manifest
 * @property {Readonly<Record<string, unknown>>} modules
 * @property {ReadonlyArray<Readonly<object>>} references
 * @property {Readonly<Record<string, unknown>>|null} applyPlan
 * @property {Readonly<Record<string, unknown>>|null} volatileTransportMetadata
 */

/**
 * Create an immutable competition package representation.
 * @param {object} [partial]
 * @returns {Readonly<CompetitionPackage>}
 */
export function createCompetitionPackage(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "CompetitionPackage must be a plain object",
      {}
    );
  }

  if ("packageVersion" in partial && partial.packageVersion != null) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION,
      "packageVersion is not part of competition package schema v1",
      { field: "packageVersion" }
    );
  }

  const packageType = isNonEmptyString(partial.packageType)
    ? String(partial.packageType).trim()
    : PACKAGE_TYPE;
  if (packageType !== PACKAGE_TYPE) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      `packageType must be ${PACKAGE_TYPE}`,
      { packageType }
    );
  }

  const schemaVersion = isNonEmptyString(partial.schemaVersion)
    ? String(partial.schemaVersion).trim()
    : COMPETITION_PACKAGE_SCHEMA_VERSION;
  if (schemaVersion !== COMPETITION_PACKAGE_SCHEMA_VERSION) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION,
      `schemaVersion must be ${COMPETITION_PACKAGE_SCHEMA_VERSION}`,
      { schemaVersion }
    );
  }

  const manifest = createCompetitionPackageManifest(partial.manifest ?? {});

  if (
    manifest.packageType !== packageType ||
    manifest.schemaVersion !== schemaVersion
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Package packageType/schemaVersion must match manifest",
      {}
    );
  }

  if (partial.modules != null && !isPlainObject(partial.modules)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "modules must be a plain object when provided",
      {}
    );
  }
  const modules = /** @type {Readonly<Record<string, unknown>>} */ (
    deepFreezeClone(partial.modules ?? {})
  );

  if (partial.references != null && !Array.isArray(partial.references)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "references must be an array when provided",
      {}
    );
  }
  const references = Object.freeze(
    (partial.references ?? []).map((ref) => {
      if (!isPlainObject(ref)) {
        throw new ImportExportError(
          IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
          "references entries must be plain objects",
          {}
        );
      }
      return deepFreezeClone(ref);
    })
  );

  /** @type {Readonly<Record<string, unknown>>|null} */
  let applyPlan = null;
  if (partial.applyPlan != null) {
    if (!isPlainObject(partial.applyPlan)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
        "applyPlan must be a plain object when provided",
        {}
      );
    }
    applyPlan = /** @type {Readonly<Record<string, unknown>>} */ (
      deepFreezeClone(partial.applyPlan)
    );
  }

  /** @type {Readonly<Record<string, unknown>>|null} */
  let volatileTransportMetadata = null;
  if (partial.volatileTransportMetadata != null) {
    if (!isPlainObject(partial.volatileTransportMetadata)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
        "volatileTransportMetadata must be a plain object when provided",
        {}
      );
    }
    volatileTransportMetadata =
      /** @type {Readonly<Record<string, unknown>>} */ (
        deepFreezeClone(partial.volatileTransportMetadata)
      );
  }

  return Object.freeze({
    packageType,
    schemaVersion,
    manifest,
    modules,
    references,
    applyPlan,
    volatileTransportMetadata,
  });
}

/**
 * Apply-plan representation only — no mutation execution.
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createApplyPlan(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.APPLY_PRECONDITION_FAILED,
      "ApplyPlan must be a plain object",
      {}
    );
  }

  const selectedModules = Array.isArray(partial.selectedModules)
    ? Object.freeze(partial.selectedModules.map((m) => String(m).trim()))
    : Object.freeze([]);

  const operations = Array.isArray(partial.operations)
    ? Object.freeze(partial.operations.map((op) => deepFreezeClone(op)))
    : Object.freeze([]);

  return Object.freeze(
    deepFreezeClone({
      planId:
        partial.planId == null || partial.planId === ""
          ? null
          : String(partial.planId).trim(),
      selectedModules,
      operations,
      dryRunRequired: partial.dryRunRequired !== false,
      mutationExecutable: false,
      notes:
        partial.notes == null || partial.notes === ""
          ? null
          : String(partial.notes),
    })
  );
}

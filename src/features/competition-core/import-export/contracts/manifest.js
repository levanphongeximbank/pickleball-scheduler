/**
 * CORE-22 — Competition package manifest contract.
 */

import {
  COMPETITION_PACKAGE_SCHEMA_VERSION,
  IMPORT_EXPORT_FORBIDDEN_FIELDS,
  MANIFEST_OPTIONAL_FIELDS,
  MANIFEST_REQUIRED_FIELDS,
  MANIFEST_VERSION,
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
  normalizeCountMap,
  normalizeStringArray,
  normalizeStringMap,
} from "../utils/helpers.js";
import { createIntegrityMetadata } from "./integrity.js";
import { createRedactionProfile } from "./redaction.js";

/**
 * @param {Record<string, unknown>} obj
 * @param {string} label
 */
function rejectForbiddenFields(obj, label) {
  for (const forbidden of IMPORT_EXPORT_FORBIDDEN_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(obj, forbidden) &&
      obj[forbidden] != null
    ) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
        `${label} must not include ${forbidden}`,
        { field: forbidden }
      );
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      `${field} is required and must be a non-empty string`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {ReadonlyArray<string>}
 */
function requireStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      `${field} must be an array`,
      { field }
    );
  }
  for (const item of value) {
    if (!isNonEmptyString(item)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
        `${field} entries must be non-empty strings`,
        { field }
      );
    }
  }
  return /** @type {ReadonlyArray<string>} */ (normalizeStringArray(value));
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {ReadonlyArray<unknown>}
 */
function normalizeOptionalArray(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      `${field} must be an array when provided`,
      { field }
    );
  }
  return Object.freeze(value.map((item) => deepFreezeClone(item)));
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {Readonly<Record<string, unknown>>|null}
 */
function normalizeOptionalObject(value, field) {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      `${field} must be a plain object when provided`,
      { field }
    );
  }
  rejectForbiddenFields(/** @type {Record<string, unknown>} */ (value), field);
  return /** @type {Readonly<Record<string, unknown>>} */ (
    deepFreezeClone(value)
  );
}

/**
 * Create an immutable competition package manifest.
 * Does not invent timestamps or random package identities.
 *
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createCompetitionPackageManifest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      "Manifest must be a plain object",
      {}
    );
  }
  rejectForbiddenFields(
    /** @type {Record<string, unknown>} */ (partial),
    "Manifest"
  );

  if ("packageVersion" in partial && partial.packageVersion != null) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION,
      "packageVersion is not part of competition package schema v1",
      { field: "packageVersion" }
    );
  }

  const manifestVersion =
    partial.manifestVersion == null
      ? MANIFEST_VERSION
      : Number(partial.manifestVersion);
  if (
    !Number.isInteger(manifestVersion) ||
    manifestVersion !== MANIFEST_VERSION
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_MANIFEST_VERSION,
      `manifestVersion must be ${MANIFEST_VERSION}`,
      { manifestVersion: partial.manifestVersion }
    );
  }

  const packageType = requireNonEmptyString(
    partial.packageType ?? PACKAGE_TYPE,
    "packageType"
  );
  if (packageType !== PACKAGE_TYPE) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      `packageType must be ${PACKAGE_TYPE}`,
      { packageType }
    );
  }

  const schemaVersion = requireNonEmptyString(
    partial.schemaVersion ?? COMPETITION_PACKAGE_SCHEMA_VERSION,
    "schemaVersion"
  );
  if (schemaVersion !== COMPETITION_PACKAGE_SCHEMA_VERSION) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION,
      `schemaVersion must be ${COMPETITION_PACKAGE_SCHEMA_VERSION}`,
      { schemaVersion }
    );
  }

  const packageId = requireNonEmptyString(partial.packageId, "packageId");
  const sourceCompetitionId = requireNonEmptyString(
    partial.sourceCompetitionId,
    "sourceCompetitionId"
  );

  const includedModules = requireStringArray(
    partial.includedModules ?? [],
    "includedModules"
  );
  const excludedModules = requireStringArray(
    partial.excludedModules ?? [],
    "excludedModules"
  );

  let moduleVersions;
  try {
    moduleVersions = normalizeStringMap(
      partial.moduleVersions ?? {},
      "moduleVersions"
    );
  } catch (err) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      err instanceof Error ? err.message : "Invalid moduleVersions",
      {}
    );
  }

  const referenceNamespaces = requireStringArray(
    partial.referenceNamespaces ?? [],
    "referenceNamespaces"
  );

  const redactionProfile = createRedactionProfile(
    partial.redactionProfile == null
      ? undefined
      : typeof partial.redactionProfile === "string"
        ? { profileId: partial.redactionProfile }
        : partial.redactionProfile
  );

  let itemCounts;
  try {
    itemCounts = normalizeCountMap(partial.itemCounts ?? {}, "itemCounts");
  } catch (err) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      err instanceof Error ? err.message : "Invalid itemCounts",
      {}
    );
  }

  const integrity = createIntegrityMetadata(partial.integrity ?? {});

  /** @type {Record<string, unknown>} */
  const manifest = {
    manifestVersion,
    packageType,
    schemaVersion,
    packageId,
    sourceCompetitionId,
    includedModules,
    excludedModules,
    moduleVersions,
    referenceNamespaces,
    redactionProfile,
    itemCounts,
    integrity,
  };

  if (partial.sourceSystem != null) {
    manifest.sourceSystem = requireNonEmptyString(
      partial.sourceSystem,
      "sourceSystem"
    );
  }
  if (partial.sourceSystemVersion != null) {
    manifest.sourceSystemVersion = requireNonEmptyString(
      partial.sourceSystemVersion,
      "sourceSystemVersion"
    );
  }
  if (partial.ruleSetVersions != null) {
    try {
      manifest.ruleSetVersions = normalizeStringMap(
        partial.ruleSetVersions,
        "ruleSetVersions"
      );
    } catch (err) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
        err instanceof Error ? err.message : "Invalid ruleSetVersions",
        {}
      );
    }
  }
  if (partial.algorithmVersions != null) {
    try {
      manifest.algorithmVersions = normalizeStringMap(
        partial.algorithmVersions,
        "algorithmVersions"
      );
    } catch (err) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
        err instanceof Error ? err.message : "Invalid algorithmVersions",
        {}
      );
    }
  }
  if (partial.exportMetadata != null) {
    manifest.exportMetadata = normalizeOptionalObject(
      partial.exportMetadata,
      "exportMetadata"
    );
  }
  if (partial.warnings != null) {
    manifest.warnings = normalizeOptionalArray(partial.warnings, "warnings");
  }
  if (partial.metadata != null) {
    manifest.metadata = normalizeOptionalObject(partial.metadata, "metadata");
  }
  if (partial.auditReferences != null) {
    manifest.auditReferences = normalizeOptionalArray(
      partial.auditReferences,
      "auditReferences"
    );
  }
  if (partial.replayReferences != null) {
    manifest.replayReferences = normalizeOptionalArray(
      partial.replayReferences,
      "replayReferences"
    );
  }

  return Object.freeze(/** @type {Readonly<object>} */ (deepFreezeClone(manifest)));
}

/**
 * Validate that a value is a well-formed v1 manifest (factory pass-through).
 * @param {unknown} value
 * @returns {Readonly<object>}
 */
export function assertCompetitionPackageManifest(value) {
  return createCompetitionPackageManifest(
    /** @type {object} */ (value == null ? {} : value)
  );
}

export {
  MANIFEST_REQUIRED_FIELDS,
  MANIFEST_OPTIONAL_FIELDS,
};

/**
 * CORE-22 import deserialize / parse / validate / normalize.
 */

import {
  COMPETITION_PACKAGE_SCHEMA_VERSION,
  MANIFEST_VERSION,
  PACKAGE_TYPE,
  VALIDATION_STATUS,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
  createFatalError,
  createValidationError,
  createWarning,
} from "../errors.js";
import { isPlainObject, isNonEmptyString } from "../utils/helpers.js";
import { createCompetitionPackage } from "../contracts/package.js";
import { createValidationResult } from "../contracts/validation.js";
import { canonicalizeJsonValue, serializeCanonical } from "../serialize/index.js";
import {
  verifyContentChecksums,
  verifyPackageChecksum,
} from "../integrity/index.js";

/**
 * Deserialize a canonical JSON string into a plain object.
 * @param {string} text
 * @returns {unknown}
 */
export function deserializeCompetitionPackage(text) {
  if (typeof text !== "string") {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DESERIALIZATION_FAILURE,
      "Serialized package must be a string",
      {}
    );
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.DESERIALIZATION_FAILURE,
      err instanceof Error ? err.message : "JSON parse failed",
      {}
    );
  }
}

/**
 * Parse a raw object into a CompetitionPackage (structural factory).
 * @param {unknown} raw
 * @returns {Readonly<object>}
 */
export function parseCompetitionPackage(raw) {
  if (!isPlainObject(raw)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Package must be a plain object",
      {}
    );
  }
  return createCompetitionPackage(/** @type {object} */ (raw));
}

/**
 * Structural + manifest + version + integrity validation.
 * Does not mutate target state.
 *
 * @param {unknown} rawOrPackage
 * @param {object} [options]
 * @param {boolean} [options.verifyIntegrity=true]
 * @returns {Readonly<object>}
 */
export function validateCompetitionPackage(rawOrPackage, options = {}) {
  /** @type {object[]} */
  const fatalErrors = [];
  /** @type {object[]} */
  const errors = [];
  /** @type {object[]} */
  const warnings = [];

  let pkg;
  try {
    pkg = isPlainObject(rawOrPackage) && rawOrPackage.manifest
      ? rawOrPackage.packageType
        ? createCompetitionPackage(/** @type {object} */ (rawOrPackage))
        : parseCompetitionPackage(rawOrPackage)
      : parseCompetitionPackage(rawOrPackage);
  } catch (err) {
    const code =
      err instanceof ImportExportError
        ? err.code
        : IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE;
    const message = err instanceof Error ? err.message : "Invalid package";
    if (
      code === IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH ||
      code === IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_MANIFEST_VERSION ||
      code === IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION
    ) {
      fatalErrors.push(createFatalError({ code, message }));
    } else {
      errors.push(createValidationError({ code, message }));
    }
    return createValidationResult({
      status: VALIDATION_STATUS.INVALID,
      fatalErrors,
      errors,
      warnings,
    });
  }

  if (pkg.packageType !== PACKAGE_TYPE) {
    fatalErrors.push(
      createFatalError({
        code: IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
        message: `packageType must be ${PACKAGE_TYPE}`,
      })
    );
  }
  if (pkg.manifest.manifestVersion !== MANIFEST_VERSION) {
    fatalErrors.push(
      createFatalError({
        code: IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_MANIFEST_VERSION,
        message: `Unsupported manifestVersion ${pkg.manifest.manifestVersion}`,
      })
    );
  }
  if (pkg.schemaVersion !== COMPETITION_PACKAGE_SCHEMA_VERSION) {
    fatalErrors.push(
      createFatalError({
        code: IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION,
        message: `Unsupported schemaVersion ${pkg.schemaVersion}`,
      })
    );
  }

  // Duplicate modules in included list.
  const included = [...(pkg.manifest.includedModules ?? [])];
  if (new Set(included).size !== included.length) {
    errors.push(
      createValidationError({
        code: IMPORT_EXPORT_ERROR_CODE.DUPLICATE_ID,
        message: "Duplicate entries in includedModules",
        fieldPath: "manifest.includedModules",
      })
    );
  }

  // included/excluded consistency.
  for (const mod of pkg.manifest.excludedModules ?? []) {
    if (included.includes(mod)) {
      errors.push(
        createValidationError({
          code: IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
          message: `Module ${mod} appears in both included and excluded`,
          fieldPath: "manifest.excludedModules",
        })
      );
    }
  }

  // Module version declarations for included modules.
  for (const mod of included) {
    if (!isNonEmptyString(pkg.manifest.moduleVersions?.[mod])) {
      errors.push(
        createValidationError({
          code: IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_MODULE_VERSION,
          message: `Missing moduleVersions for ${mod}`,
          fieldPath: `manifest.moduleVersions.${mod}`,
        })
      );
    }
    if (!(mod in (pkg.modules ?? {}))) {
      errors.push(
        createValidationError({
          code: IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
          message: `Included module ${mod} missing from modules payload`,
          fieldPath: `modules.${mod}`,
        })
      );
    }
  }

  // Content checksum presence.
  const contentChecksums = pkg.manifest.integrity?.contentChecksums ?? {};
  for (const mod of included) {
    if (!isNonEmptyString(contentChecksums[mod])) {
      errors.push(
        createValidationError({
          code: IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
          message: `Missing content checksum for ${mod}`,
          fieldPath: `manifest.integrity.contentChecksums.${mod}`,
        })
      );
    }
  }

  // Malformed references.
  if (!Array.isArray(pkg.references)) {
    errors.push(
      createValidationError({
        code: IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
        message: "references must be an array",
        fieldPath: "references",
      })
    );
  } else {
    for (let i = 0; i < pkg.references.length; i++) {
      const ref = pkg.references[i];
      if (!isPlainObject(ref)) {
        errors.push(
          createValidationError({
            code: IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
            message: `Malformed reference at index ${i}`,
            fieldPath: `references[${i}]`,
          })
        );
      }
    }
  }

  // Redaction / partial policy declarations.
  if (!pkg.manifest.redactionProfile) {
    errors.push(
      createValidationError({
        code: IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
        message: "redactionProfile is required",
        fieldPath: "manifest.redactionProfile",
      })
    );
  }

  if (options.verifyIntegrity !== false && fatalErrors.length === 0) {
    try {
      verifyPackageChecksum(pkg);
      verifyContentChecksums(pkg);
    } catch (err) {
      fatalErrors.push(
        createFatalError({
          code:
            err instanceof ImportExportError
              ? err.code
              : IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
          message: err instanceof Error ? err.message : "Integrity failure",
        })
      );
    }
  }

  // Unknown optional metadata → warning.
  if (
    isPlainObject(pkg.manifest.metadata) &&
    Object.keys(pkg.manifest.metadata).some((k) => k.startsWith("x-unknown"))
  ) {
    warnings.push(
      createWarning({
        code: "UNKNOWN_OPTIONAL_METADATA",
        message: "Unknown optional metadata keys present",
        fieldPath: "manifest.metadata",
      })
    );
  }

  const status =
    fatalErrors.length > 0 || errors.length > 0
      ? VALIDATION_STATUS.INVALID
      : warnings.length > 0
        ? VALIDATION_STATUS.VALID_WITH_WARNINGS
        : VALIDATION_STATUS.VALID;

  return createValidationResult({
    status,
    fatalErrors,
    errors,
    warnings,
    schemaVersion: pkg.schemaVersion,
    manifestVersion: pkg.manifest.manifestVersion,
  });
}

/**
 * Normalize a validated package (canonical clone; set-collections sorted).
 * @param {object} pkg
 * @returns {unknown}
 */
export function normalizeCompetitionPackage(pkg) {
  return canonicalizeJsonValue(pkg);
}

/**
 * Round-trip helper: serialize → deserialize → parse.
 * @param {object} pkg
 * @returns {Readonly<object>}
 */
export function roundTripSerializeParse(pkg) {
  const text = serializeCanonical(pkg);
  const raw = deserializeCompetitionPackage(text);
  return parseCompetitionPackage(raw);
}

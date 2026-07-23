/**
 * CORE-22 — Integrity metadata contract (hashing not implemented in Phase 1B).
 */

import {
  CANONICALIZATION_VERSION,
  INTEGRITY_ALGORITHM,
  PACKAGE_CHECKSUM_EXCLUDED_FIELDS,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
  normalizeStringMap,
} from "../utils/helpers.js";

/**
 * @typedef {Object} IntegrityMetadata
 * @property {string} algorithm
 * @property {Readonly<Record<string, string>>} contentChecksums
 * @property {string|null} packageChecksum
 * @property {string} canonicalizationVersion
 * @property {ReadonlyArray<string>} packageChecksumExcludedFields
 * @property {boolean} checksumAfterRedaction
 * @property {string} checksumMismatchSeverity
 */

/**
 * Contract-only integrity metadata. Does not compute hashes.
 * @param {object} [partial]
 * @returns {Readonly<IntegrityMetadata>}
 */
export function createIntegrityMetadata(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      "integrity must be a plain object",
      {}
    );
  }

  const algorithm = isNonEmptyString(partial.algorithm)
    ? String(partial.algorithm).trim()
    : INTEGRITY_ALGORITHM;
  if (algorithm !== INTEGRITY_ALGORITHM) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION,
      `integrity.algorithm must be ${INTEGRITY_ALGORITHM}`,
      { algorithm }
    );
  }

  const canonicalizationVersion = isNonEmptyString(
    partial.canonicalizationVersion
  )
    ? String(partial.canonicalizationVersion).trim()
    : CANONICALIZATION_VERSION;

  let contentChecksums;
  try {
    contentChecksums = normalizeStringMap(
      partial.contentChecksums,
      "contentChecksums"
    );
  } catch (err) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      err instanceof Error ? err.message : "Invalid contentChecksums",
      {}
    );
  }

  const packageChecksum =
    partial.packageChecksum == null || partial.packageChecksum === ""
      ? null
      : String(partial.packageChecksum).trim();

  const excluded =
    partial.packageChecksumExcludedFields == null
      ? PACKAGE_CHECKSUM_EXCLUDED_FIELDS
      : Object.freeze(
          [...partial.packageChecksumExcludedFields].map((f) => String(f))
        );

  for (const required of PACKAGE_CHECKSUM_EXCLUDED_FIELDS) {
    if (!excluded.includes(required)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
        `integrity must exclude ${required} from package checksum`,
        { field: required }
      );
    }
  }

  return Object.freeze(
    /** @type {IntegrityMetadata} */ (
      deepFreezeClone({
        algorithm,
        contentChecksums,
        packageChecksum,
        canonicalizationVersion,
        packageChecksumExcludedFields: excluded,
        checksumAfterRedaction: true,
        checksumMismatchSeverity: "FATAL",
      })
    )
  );
}

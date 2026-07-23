/**
 * CORE-22 SHA-256 integrity (sha256-canonical-json-v1).
 * Uses Node built-in crypto. Never uses CORE-21 FNV fingerprints.
 */

import { createHash } from "node:crypto";
import {
  PACKAGE_CHECKSUM_EXCLUDED_FIELDS,
  VOLATILE_TRANSPORT_METADATA_FIELDS,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import { isPlainObject } from "../utils/helpers.js";
import { serializeCanonical } from "../serialize/index.js";

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

/**
 * @param {string} hex
 * @returns {boolean}
 */
export function isSha256Hex(hex) {
  return typeof hex === "string" && SHA256_HEX_RE.test(hex);
}

/**
 * @param {string} canonicalUtf8
 * @returns {string} lowercase 64-char hex
 */
export function sha256Hex(canonicalUtf8) {
  if (typeof canonicalUtf8 !== "string") {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.SERIALIZATION_FAILURE,
      "sha256Hex requires a string",
      {}
    );
  }
  return createHash("sha256").update(canonicalUtf8, "utf8").digest("hex");
}

/**
 * SHA-256 of a value after canonical serialization.
 * @param {unknown} value
 * @returns {string}
 */
export function sha256Canonical(value) {
  return sha256Hex(serializeCanonical(value));
}

/**
 * Build checksum input for a competition package.
 * Excludes packageId, packageChecksum, and volatile transport metadata.
 *
 * @param {object} pkg
 * @returns {unknown}
 */
export function buildPackageChecksumInput(pkg) {
  if (!isPlainObject(pkg)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "Package checksum input requires a plain package object",
      {}
    );
  }

  const source = /** @type {Record<string, unknown>} */ (pkg);
  /** @type {Record<string, unknown>} */
  const out = {};

  for (const key of Object.keys(source)) {
    if (key === "volatileTransportMetadata") continue;
    if (PACKAGE_CHECKSUM_EXCLUDED_FIELDS.includes(key)) continue;
    if (key === "manifest" && isPlainObject(source.manifest)) {
      out.manifest = stripManifestForChecksum(
        /** @type {Record<string, unknown>} */ (source.manifest)
      );
      continue;
    }
    out[key] = source[key];
  }

  return out;
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {Record<string, unknown>}
 */
function stripManifestForChecksum(manifest) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(manifest)) {
    if (key === "packageId") continue;
    if (key === "volatileTransportMetadata") continue;
    if (key === "integrity" && isPlainObject(manifest.integrity)) {
      const integrity = /** @type {Record<string, unknown>} */ (
        manifest.integrity
      );
      /** @type {Record<string, unknown>} */
      const integrityOut = {};
      for (const ik of Object.keys(integrity)) {
        if (ik === "packageChecksum") continue;
        integrityOut[ik] = integrity[ik];
      }
      out.integrity = integrityOut;
      continue;
    }
    if (key === "metadata" && isPlainObject(manifest.metadata)) {
      // Drop volatile transport keys nested under metadata if present.
      const meta = /** @type {Record<string, unknown>} */ (manifest.metadata);
      /** @type {Record<string, unknown>} */
      const metaOut = {};
      for (const mk of Object.keys(meta)) {
        if (VOLATILE_TRANSPORT_METADATA_FIELDS.includes(mk)) continue;
        metaOut[mk] = meta[mk];
      }
      out.metadata = metaOut;
      continue;
    }
    out[key] = manifest[key];
  }
  return out;
}

/**
 * Compute package checksum (SHA-256 of canonical checksum input).
 * @param {object} pkg
 * @returns {string}
 */
export function computePackageChecksum(pkg) {
  return sha256Canonical(buildPackageChecksumInput(pkg));
}

/**
 * Compute per-section content checksums for module payloads.
 * @param {Record<string, unknown>} modules
 * @returns {Readonly<Record<string, string>>}
 */
export function computeContentChecksums(modules) {
  if (!isPlainObject(modules)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "modules must be a plain object for content checksums",
      {}
    );
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of Object.keys(modules).sort()) {
    out[key] = sha256Canonical(modules[key]);
  }
  return Object.freeze(out);
}

/**
 * Build deterministic packageId from package checksum.
 * Format: core22pkg:sha256:<64-lowercase-hex>
 * @param {string} packageChecksum
 * @returns {string}
 */
export function buildPackageId(packageChecksum) {
  if (!isSha256Hex(packageChecksum)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
      "packageChecksum must be a 64-char lowercase hex SHA-256 digest",
      {}
    );
  }
  return `core22pkg:sha256:${packageChecksum}`;
}

/**
 * Verify package checksum; throws CHECKSUM_MISMATCH on failure.
 * @param {object} pkg
 * @returns {{ ok: true, packageChecksum: string, packageId: string }}
 */
export function verifyPackageChecksum(pkg) {
  if (!isPlainObject(pkg)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "verifyPackageChecksum requires a package object",
      {}
    );
  }
  const computed = computePackageChecksum(pkg);
  const declared =
    pkg.manifest &&
    typeof pkg.manifest === "object" &&
    pkg.manifest.integrity &&
    typeof pkg.manifest.integrity.packageChecksum === "string"
      ? String(pkg.manifest.integrity.packageChecksum).trim()
      : null;

  if (!declared || !isSha256Hex(declared)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
      "Package integrity.packageChecksum missing or malformed",
      { declared }
    );
  }
  if (declared !== computed) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
      "Package checksum mismatch",
      { declared, computed }
    );
  }

  const expectedId = buildPackageId(computed);
  const packageId =
    pkg.manifest && typeof pkg.manifest.packageId === "string"
      ? String(pkg.manifest.packageId).trim()
      : null;
  if (packageId !== expectedId) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
      "packageId does not match package checksum",
      { packageId, expectedId }
    );
  }

  return { ok: true, packageChecksum: computed, packageId: expectedId };
}

/**
 * Verify per-section content checksums.
 * @param {object} pkg
 * @returns {{ ok: true, contentChecksums: Readonly<Record<string, string>> }}
 */
export function verifyContentChecksums(pkg) {
  if (!isPlainObject(pkg) || !isPlainObject(pkg.modules)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "verifyContentChecksums requires package.modules",
      {}
    );
  }
  const computed = computeContentChecksums(
    /** @type {Record<string, unknown>} */ (pkg.modules)
  );
  const declared =
    pkg.manifest &&
    pkg.manifest.integrity &&
    isPlainObject(pkg.manifest.integrity.contentChecksums)
      ? /** @type {Record<string, string>} */ (
          pkg.manifest.integrity.contentChecksums
        )
      : {};

  for (const key of Object.keys(computed)) {
    if (declared[key] !== computed[key]) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
        `Content checksum mismatch for module ${key}`,
        { module: key, declared: declared[key] ?? null, computed: computed[key] }
      );
    }
  }
  for (const key of Object.keys(declared)) {
    if (!(key in computed)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
        `Declared content checksum for missing module ${key}`,
        { module: key }
      );
    }
  }
  return { ok: true, contentChecksums: computed };
}

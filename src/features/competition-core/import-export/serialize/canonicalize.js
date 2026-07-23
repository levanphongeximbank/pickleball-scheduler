/**
 * CORE-22 package-scoped canonical JSON (core22.canonical-json.v1).
 *
 * Why package-scoped (not CORE-21 serializeCanonical reuse):
 * - Package checksum must use SHA-256 over CORE-22-owned byte identity, never CORE-21 FNV.
 * - CORE-22 must emit ImportExportError (not DeterministicSeedReplayError).
 * - CORE-22 owns set-collection normalization rules for package-controlled arrays.
 * Rules align with CORE-21 public canonicalizeJsonValue for scalar/object behavior.
 */

import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import { compareStableString, isPlainObject } from "../utils/helpers.js";

/** Set-like collection paths (relative to package root) sorted lexicographically. */
export const SET_COLLECTION_KEYS = Object.freeze([
  "includedModules",
  "excludedModules",
  "referenceNamespaces",
  "warnings",
  "auditReferences",
  "replayReferences",
  "requiredAdapters",
  "unsupportedModules",
  "selectedModules",
  "omittedModules",
  "dependencyClosure",
  "conflictIds",
  "appliedCandidateIds",
  "pendingCandidateIds",
  "rejectedCandidateIds",
  "noReleakSurfaces",
  "removedPaths",
  "excludedFieldPaths",
  "maskedFieldPaths",
  "packageChecksumExcludedFields",
  "resolutionOptions",
]);

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {never}
 */
function reject(value, path) {
  const type =
    value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : value instanceof Date
          ? "Date"
          : value instanceof Map
            ? "Map"
            : value instanceof Set
              ? "Set"
              : typeof value;
  throw new ImportExportError(
    IMPORT_EXPORT_ERROR_CODE.SERIALIZATION_FAILURE,
    `Non-canonical value at ${path || "(root)"}: ${type}`,
    { path, type }
  );
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isSetCollectionKey(key) {
  return SET_COLLECTION_KEYS.includes(key);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isSortableStringArray(value) {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

/**
 * Deterministic composite key for conflict / mapping entries.
 * @param {unknown} entry
 * @returns {string}
 */
function entrySortKey(entry) {
  if (!isPlainObject(entry)) return "";
  const e = /** @type {Record<string, unknown>} */ (entry);
  if (typeof e.conflictId === "string") return e.conflictId;
  if (typeof e.sourceId === "string" && typeof e.sourceNamespace === "string") {
    return `${e.sourceNamespace}\0${e.entityType ?? ""}\0${e.sourceId}`;
  }
  if (typeof e.sourceReference === "string") {
    return `${e.sourceNamespace ?? ""}\0${e.sourceReference}`;
  }
  if (typeof e.moduleId === "string") return e.moduleId;
  if (typeof e.code === "string") return e.code;
  return JSON.stringify(e);
}

/**
 * @param {unknown} value
 * @param {string} [path]
 * @param {string|null} [parentKey]
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeJsonValue(
  value,
  path = "",
  parentKey = null,
  seen = new WeakSet()
) {
  if (value === null) return null;

  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.SERIALIZATION_FAILURE,
        `Non-finite number at ${path || "(root)"}`,
        { path, value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    reject(value, path);
  }
  if (t !== "object") reject(value, path);

  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    reject(value, path);
  }

  if (seen.has(/** @type {object} */ (value))) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.SERIALIZATION_FAILURE,
      `Cyclic reference at ${path || "(root)"}`,
      { path }
    );
  }
  seen.add(/** @type {object} */ (value));

  if (Array.isArray(value)) {
    const mapped = value.map((item, i) =>
      canonicalizeJsonValue(
        item,
        path ? `${path}[${i}]` : `[${i}]`,
        parentKey,
        seen
      )
    );

    // Set-like string arrays: sort. Conflict/mapping arrays: sort by stable key.
    if (
      parentKey &&
      isSetCollectionKey(parentKey) &&
      isSortableStringArray(mapped)
    ) {
      return [...mapped].sort((a, b) =>
        compareStableString(/** @type {string} */ (a), /** @type {string} */ (b))
      );
    }
    if (
      parentKey === "conflicts" ||
      parentKey === "entries" ||
      parentKey === "contentChecksumEntries" ||
      parentKey === "moduleVersionEntries" ||
      parentKey === "mappings" ||
      parentKey === "idMappings" ||
      parentKey === "referenceMappings"
    ) {
      return [...mapped].sort((a, b) =>
        compareStableString(entrySortKey(a), entrySortKey(b))
      );
    }
    // Domain / business arrays: preserve order.
    return mapped;
  }

  if (!isPlainObject(value)) reject(value, path);

  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort(
    compareStableString
  );
  for (const key of keys) {
    const child = /** @type {Record<string, unknown>} */ (value)[key];
    // Drop undefined object properties consistently (omit).
    if (child === undefined) continue;
    out[key] = canonicalizeJsonValue(
      child,
      path ? `${path}.${key}` : key,
      key,
      seen
    );
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function serializeCanonical(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

/**
 * Deep-freeze a canonical clone (does not mutate input).
 * @param {unknown} value
 * @returns {unknown}
 */
export function deepFreezeCanonical(value) {
  const canonical = canonicalizeJsonValue(value);
  return freezeDeep(canonical);
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeDeep(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeDeep(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value).sort(compareStableString)) {
    out[key] = freezeDeep(/** @type {Record<string, unknown>} */ (value)[key]);
  }
  return Object.freeze(out);
}

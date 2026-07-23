/**
 * CORE-17-local FNV-1a 32-bit fingerprint over canonical JSON.
 * Pattern mirrored from CORE-10/12; no cross-CORE deep imports.
 */

import { VALIDATED_RESULT_FINGERPRINT_V1 } from "./resultValidationConstants.js";
import {
  RESULT_ERROR_CODE,
  ResultValidationError,
} from "./resultValidationErrors.js";

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareStableString(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  if (value instanceof Map) return false;
  if (value instanceof Set) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * @param {string} input
 * @returns {number}
 */
export function hashStringToUint32(input) {
  let hash = 2166136261;
  const str = String(input ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeJsonValue(value, seen = new WeakSet()) {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
        "Non-finite number in canonical serialization",
        { value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      `Unsupported type in canonical serialization: ${t}`,
      { type: t }
    );
  }
  if (t !== "object") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "Unsupported value in canonical serialization",
      { type: t }
    );
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "Date/Map/Set forbidden in canonical serialization",
      {}
    );
  }
  if (seen.has(/** @type {object} */ (value))) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "Cyclic reference in canonical serialization",
      {}
    );
  }
  seen.add(/** @type {object} */ (value));
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "Non-plain object in canonical serialization",
      {}
    );
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort(
    compareStableString
  );
  for (const key of keys) {
    out[key] = canonicalizeJsonValue(
      /** @type {Record<string, unknown>} */ (value)[key],
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
 * Deep-freeze an owned clone. Does not mutate caller input.
 * @param {unknown} value
 * @returns {unknown}
 */
export function deepFreezeClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreezeClone(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(/** @type {Record<string, unknown>} */ (value))) {
    out[key] = deepFreezeClone(
      /** @type {Record<string, unknown>} */ (value)[key]
    );
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} value
 * @returns {string} 8-char lowercase hex
 */
export function fingerprintCanonicalMaterial(value) {
  const material = {
    fingerprintAlgorithmVersion: VALIDATED_RESULT_FINGERPRINT_V1,
    payload: canonicalizeJsonValue(value),
  };
  const serialized = JSON.stringify(material);
  return hashStringToUint32(serialized).toString(16).padStart(8, "0");
}

/**
 * Digest for CORE-16 projection reference fields (CORE-17 owned).
 * @param {object} digestInput
 * @returns {string}
 */
export function computeProjectionInputDigest(digestInput) {
  return fingerprintCanonicalMaterial({
    digestKind: "competition-core.validated-result.projection-digest.v1",
    ...digestInput,
  });
}

/**
 * CORE-23 checkpoint integrity fingerprint (FNV-1a 32-bit).
 * Identity hash for fail-closed integrity checks — not a security hash.
 */

import { CORE23_CHECKPOINT_FINGERPRINT_VERSION } from "../constants.js";
import { compareStableString, isPlainObject } from "./helpers.js";

/**
 * @param {string} input
 * @returns {number}
 */
export function hashStringToUint32(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalizeJsonValue(value) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Non-finite numbers are not canonicalizable");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }
  if (!isPlainObject(value)) {
    throw new TypeError("Unsupported value for canonicalization");
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value).sort(compareStableString)) {
    const v = /** @type {Record<string, unknown>} */ (value)[key];
    if (v === undefined) continue;
    out[key] = canonicalizeJsonValue(v);
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
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintValue(value) {
  const hex = hashStringToUint32(serializeCanonical(value))
    .toString(16)
    .padStart(8, "0");
  return `${CORE23_CHECKPOINT_FINGERPRINT_VERSION}:${hex}`;
}

/**
 * Shared helpers for CM-05 contracts (pure, deterministic).
 * Duplicated locally to keep module boundary clear.
 */

import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionBrandingError } from "../errors/CompetitionBrandingError.js";
import { COMPETITION_BRANDING_FINGERPRINT_ALGORITHM } from "../constants/comparison.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failContract(code, message, details) {
  throw new CompetitionBrandingError(code, message, details);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1;
}

/**
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    const child = /** @type {Record<string|symbol, unknown>} */ (value)[key];
    if (child && typeof child === "object") {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clonePlain(value) {
  return /** @type {T} */ (JSON.parse(JSON.stringify(value)));
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareFieldPath(a, b) {
  return String(a).localeCompare(String(b), "en");
}

/**
 * Key-sorted JSON stringify for deterministic hashing.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizeJson(value) {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      /** @type {Record<string, unknown>} */
      const sorted = {};
      for (const key of Object.keys(v).sort((a, b) => a.localeCompare(b, "en"))) {
        sorted[key] = v[key];
      }
      return sorted;
    }
    return v;
  });
}

/**
 * Deterministic content fingerprint (not cryptographic / not CORE-21 ownership).
 * @param {unknown} value
 * @returns {string}
 */
export function stableContentFingerprint(value) {
  const json = canonicalizeJson(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${COMPETITION_BRANDING_FINGERPRINT_ALGORITHM.prefix}${(hash >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

/**
 * Reject control characters (C0 + DEL). Avoid regex control-char class for eslint.
 * @param {string} value
 * @returns {boolean}
 */
export function hasControlCharacters(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
      `Missing or invalid required field: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

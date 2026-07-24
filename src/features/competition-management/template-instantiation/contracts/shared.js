/**
 * Shared helpers for CM-02 contracts (pure, deterministic).
 * Duplicated locally (not imported from CM-01 internals) to keep boundary clear;
 * CM-02 consumes CM-01 public facade for definition commands/types only.
 */

import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionTemplateError } from "../errors/CompetitionTemplateError.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failContract(code, message, details) {
  throw new CompetitionTemplateError(code, message, details);
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
 * Deterministic stable checksum for plan identity (not cryptographic).
 * @param {unknown} value
 * @returns {string}
 */
export function stableChecksum(value) {
  const json = JSON.stringify(value, (_, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sorted = {};
      for (const key of Object.keys(v).sort((a, b) => a.localeCompare(b, "en"))) {
        sorted[key] = v[key];
      }
      return sorted;
    }
    return v;
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `cm02-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      COMPETITION_TEMPLATE_ERROR_CODE.INVALID_CONTRACT,
      `Missing or invalid required field: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

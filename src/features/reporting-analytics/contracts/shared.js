/**
 * Shared validation helpers for Reporting & Analytics contracts (REPORTING-01).
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failContract(code, message, details) {
  throw new ReportingError(code, message, details);
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
export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const ISO_INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidIsoInstant(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (!ISO_INSTANT_RE.test(value.trim())) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      `Missing or invalid required field: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireOpaqueId(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_IDENTITY,
      `Invalid opaque identity: ${field}`,
      { field }
    );
  }
  const id = String(value).trim();
  if (id.length > 128) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_IDENTITY,
      `Identity too long: ${field}`,
      { field }
    );
  }
  return id;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function optionalNonEmptyString(value, field) {
  if (value == null || value === "") return null;
  if (!isNonEmptyString(value)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      `Optional field must be a non-empty string when provided: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function optionalOpaqueId(value, field) {
  if (value == null || value === "") return null;
  return requireOpaqueId(value, field);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireIsoInstant(value, field) {
  if (!isValidIsoInstant(value)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      `Missing or invalid ISO instant: ${field}`,
      { field, value }
    );
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function optionalIsoInstant(value, field) {
  if (value == null || value === "") return null;
  return requireIsoInstant(value, field);
}

/**
 * @param {string} [prefix]
 * @param {string} [seed]
 * @returns {string}
 */
export function createSeededId(prefix, seed) {
  const p = isNonEmptyString(prefix) ? String(prefix).trim() : "rpt";
  if (!isNonEmptyString(seed)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_IDENTITY,
      "createSeededId requires an explicit seed (no silent random id in domain)",
      { field: "seed", prefix: p }
    );
  }
  return `${p}_${String(seed).trim()}`;
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

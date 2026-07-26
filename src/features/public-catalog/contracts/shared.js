/**
 * Shared contract helpers for Public Catalog (PUBLIC-CATALOG-01).
 */

import { PUBLIC_CATALOG_ERROR_CODE } from "../errors/errorCodes.js";
import { PublicCatalogError } from "../errors/PublicCatalogError.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failContract(code, message, details) {
  throw new PublicCatalogError(code, message, details);
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

/**
 * @param {unknown} value
 * @returns {object}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.INVALID_CONTRACT,
      `Missing or invalid required field: ${field}`,
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
export function optionalNonEmptyString(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.INVALID_CONTRACT,
      `Invalid optional string field: ${field}`,
      { field }
    );
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

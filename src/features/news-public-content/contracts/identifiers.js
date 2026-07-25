/**
 * Opaque identity helpers (NEWS-01).
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { failContract, isNonEmptyString } from "./shared.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireOpaqueId(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_IDENTITY,
      `Invalid opaque identity: ${field}`,
      { field }
    );
  }
  const id = String(value).trim();
  if (id.length > 128) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_IDENTITY,
      `Identity too long: ${field}`,
      { field }
    );
  }
  return id;
}

/**
 * @param {string} [prefix]
 * @param {string} [seed]
 * @returns {string}
 */
export function createContentId(prefix = "cnt", seed) {
  const p = isNonEmptyString(prefix) ? String(prefix).trim() : "cnt";
  if (isNonEmptyString(seed)) {
    return `${p}_${String(seed).trim()}`;
  }
  failContract(
    NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_IDENTITY,
    "createContentId requires an explicit seed (no silent random id in domain)",
    { field: "seed" }
  );
}

/**
 * @param {string} [seed]
 * @returns {string}
 */
export function createRevisionId(seed) {
  return createContentId("rev", seed);
}

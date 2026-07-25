/**
 * Shared validation helpers for News & Public Content contracts (NEWS-01).
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { NewsPublicContentError } from "../errors/NewsPublicContentError.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failContract(code, message, details) {
  throw new NewsPublicContentError(code, message, details);
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
 * Absolute ISO instant with explicit timezone (Z or ±HH:MM).
 * Aligns with Platform Core isoClock expectations without importing internals.
 */
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
 * @param {string} value
 * @returns {number}
 */
export function isoInstantMs(value) {
  return Date.parse(value);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_FIELD,
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
export function requireIsoInstant(value, field) {
  if (!isValidIsoInstant(value)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_PUBLICATION_WINDOW,
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
export function optionalNonEmptyString(value, field) {
  if (value == null || value === "") return null;
  if (!isNonEmptyString(value)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_FIELD,
      `Optional field must be a non-empty string when provided: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * Slug: lowercase letters, digits, hyphens; 1–120 chars; no leading/trailing hyphen.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidSlug(value) {
  if (typeof value !== "string") return false;
  const slug = value.trim();
  if (slug.length < 1 || slug.length > 120) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Locale: BCP-47-ish language[-region] (e.g. vi, en-US, vi-VN).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidLocale(value) {
  if (typeof value !== "string") return false;
  const locale = value.trim();
  return /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/.test(locale);
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

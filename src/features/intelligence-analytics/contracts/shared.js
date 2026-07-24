/**
 * Shared helpers for Intelligence & Analytics contracts.
 * No database, React, Platform Core, or business-module imports.
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, *>}
 */
export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
export function isValidIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

/**
 * Deep-freeze a plain JSON-safe object graph.
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return /** @type {Readonly<T>} */ (value);
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
 * Shallow JSON-safe clone for contract construction.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clonePlain(value) {
  return /** @type {T} */ (JSON.parse(JSON.stringify(value)));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Shared JSON-safe helpers for runtime-control (no Date.now / Math.random / env).
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isJsonSafe(value) {
  try {
    JSON.parse(JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deep-freeze for purity tests (shallow nested freeze).
 * @param {object} obj
 * @returns {object}
 */
export function deepFreeze(obj) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v && typeof v === "object" && !Object.isFrozen(v)) {
      deepFreeze(v);
    }
  }
  return obj;
}

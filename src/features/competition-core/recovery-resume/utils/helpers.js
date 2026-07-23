/**
 * CORE-23-local helpers — pure, no wall-clock / random / I/O.
 */

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
export function isNonNegativeInteger(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    Number.isFinite(value)
  );
}

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
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function deepFreezeClone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(/** @type {object} */ (value))) {
    throw new TypeError("Cannot deep-freeze cyclic structure");
  }
  seen.add(/** @type {object} */ (value));

  if (Array.isArray(value)) {
    const next = value.map((item) => deepFreezeClone(item, seen));
    return Object.freeze(next);
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value).sort(compareStableString)) {
    out[key] = deepFreezeClone(
      /** @type {Record<string, unknown>} */ (value)[key],
      seen
    );
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeIdList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new TypeError("Expected array of string ids");
  }
  const ids = value.map((item) => {
    if (!isNonEmptyString(item)) {
      throw new TypeError("Id list entries must be non-empty strings");
    }
    return String(item).trim();
  });
  return [...ids].sort(compareStableString);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function requireNonNegativeInteger(value, field) {
  if (!isNonNegativeInteger(value)) {
    throw new TypeError(`${field} must be a non-negative integer`);
  }
  return /** @type {number} */ (value);
}

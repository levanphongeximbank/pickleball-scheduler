/**
 * CORE-22-local helpers — pure, no wall-clock / random / I/O.
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
 * Deterministic array clone + UTF-16 sort (string elements only).
 * Non-string arrays are cloned in input order without reordering.
 * @param {unknown} value
 * @returns {ReadonlyArray<unknown>}
 */
export function normalizeStringArray(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new TypeError("Expected array for normalizeStringArray");
  }
  const cloned = value.map((item) =>
    typeof item === "string" ? item.trim() : item
  );
  const allStrings = cloned.every((item) => typeof item === "string");
  if (allStrings) {
    return Object.freeze(
      [...cloned].sort((a, b) =>
        compareStableString(/** @type {string} */ (a), /** @type {string} */ (b))
      )
    );
  }
  return Object.freeze([...cloned]);
}

/**
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function deepFreezeClone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(/** @type {object} */ (value))) {
    throw new TypeError("Circular reference in deepFreezeClone");
  }
  seen.add(/** @type {object} */ (value));

  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreezeClone(item, seen)));
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
 * Shallow freeze of a string→string map with sorted keys.
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {Readonly<Record<string, string>>}
 */
export function normalizeStringMap(value, fieldName) {
  if (value == null) return Object.freeze({});
  if (!isPlainObject(value)) {
    throw new TypeError(`${fieldName} must be a plain object`);
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of Object.keys(value).sort(compareStableString)) {
    const v = /** @type {Record<string, unknown>} */ (value)[key];
    if (typeof v !== "string" || !v.trim()) {
      throw new TypeError(`${fieldName}.${key} must be a non-empty string`);
    }
    out[key] = v.trim();
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {Readonly<Record<string, number>>}
 */
export function normalizeCountMap(value, fieldName) {
  if (value == null) return Object.freeze({});
  if (!isPlainObject(value)) {
    throw new TypeError(`${fieldName} must be a plain object`);
  }
  /** @type {Record<string, number>} */
  const out = {};
  for (const key of Object.keys(value).sort(compareStableString)) {
    const v = /** @type {Record<string, unknown>} */ (value)[key];
    if (!isNonNegativeInteger(v)) {
      throw new TypeError(
        `${fieldName}.${key} must be a non-negative integer`
      );
    }
    out[key] = /** @type {number} */ (v);
  }
  return Object.freeze(out);
}

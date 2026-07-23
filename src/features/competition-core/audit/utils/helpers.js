/**
 * CORE-20-local helpers — no wall-clock / random generators.
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
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
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
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {string} input
 * @returns {number}
 */
export function hashStringToUint32(input) {
  let hash = 2166136261;
  const str = String(input ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeJson(value, seen = new WeakSet()) {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Non-finite number in canonical JSON");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new TypeError(`Unsupported type in canonical JSON: ${t}`);
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new TypeError("Non-plain object in canonical JSON");
  }
  if (seen.has(value)) {
    throw new TypeError("Circular reference in canonical JSON");
  }
  seen.add(value);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value).sort(compareStableString)) {
    out[key] = canonicalizeJson(value[key], seen);
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function serializeCanonicalJson(value) {
  return JSON.stringify(canonicalizeJson(value));
}

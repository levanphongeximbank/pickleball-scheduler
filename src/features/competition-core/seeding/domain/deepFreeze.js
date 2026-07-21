/**
 * Shallow-safe deep freeze for normalized CORE-07 domain outputs.
 * Does not mutate caller input; clones plain objects/arrays first when requested.
 */

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return Object.freeze(value);
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(/** @type {Record<string, unknown>} */ (value)[keys[i]]);
  }
  return Object.freeze(value);
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepFreezeClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return deepFreeze(value.map((item) => deepFreezeClone(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    out[key] = deepFreezeClone(
      /** @type {Record<string, unknown>} */ (value)[key]
    );
  }
  return deepFreeze(out);
}

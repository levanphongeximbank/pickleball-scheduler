/**
 * CORE-21 — canonical clone + JSON-safe materialization.
 * Rejects non-replay-certified values. Does not mutate caller inputs.
 */

import { DETERMINISTIC_SEED_REPLAY_ERROR_CODE } from "../errors/errorCodes.js";
import { DeterministicSeedReplayError } from "../errors/DeterministicSeedReplayError.js";
import { compareStableString } from "../ordering/compare.js";

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
 * @param {string} path
 * @returns {never}
 */
function rejectNonCanonical(value, path) {
  const type =
    value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : value instanceof Date
          ? "Date"
          : value instanceof Map
            ? "Map"
            : value instanceof Set
              ? "Set"
              : typeof value;
  throw new DeterministicSeedReplayError(
    DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
    `Non-canonical value at ${path || "(root)"}: ${type}`,
    { path, type }
  );
}

/**
 * Deep-copy JSON-canonical values and recursively freeze.
 * Rejects: functions, symbols, bigint, Date, Map, Set, undefined, NaN, Infinity, cycles.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function deepFreezeCanonical(value, path = "", seen = new WeakSet()) {
  if (value === null) return null;

  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new DeterministicSeedReplayError(
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
        `Non-finite number at ${path || "(root)"}`,
        { path, value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    rejectNonCanonical(value, path);
  }
  if (t !== "object") rejectNonCanonical(value, path);

  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    rejectNonCanonical(value, path);
  }

  if (seen.has(/** @type {object} */ (value))) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
      `Cyclic reference at ${path || "(root)"}`,
      { path }
    );
  }
  seen.add(/** @type {object} */ (value));

  if (Array.isArray(value)) {
    const out = value.map((item, i) =>
      deepFreezeCanonical(item, path ? `${path}[${i}]` : `[${i}]`, seen)
    );
    return Object.freeze(out);
  }

  if (!isPlainObject(value)) rejectNonCanonical(value, path);

  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort(
    compareStableString
  );
  for (const key of keys) {
    out[key] = deepFreezeCanonical(
      /** @type {Record<string, unknown>} */ (value)[key],
      path ? `${path}.${key}` : key,
      seen
    );
  }
  return Object.freeze(out);
}

/**
 * Canonicalize for serialization (owned clone; does not mutate input).
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeJsonValue(value, seen = new WeakSet()) {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new DeterministicSeedReplayError(
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
        "Non-finite number in canonical serialization",
        { value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
      `Unsupported type in canonical serialization: ${t}`,
      { type: t }
    );
  }
  if (t !== "object") {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
      "Unsupported value in canonical serialization",
      { type: t }
    );
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
      "Date/Map/Set forbidden in canonical serialization",
      {}
    );
  }
  if (seen.has(/** @type {object} */ (value))) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
      "Cyclic reference in canonical serialization",
      {}
    );
  }
  seen.add(/** @type {object} */ (value));
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED,
      "Non-plain object in canonical serialization",
      {}
    );
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort(
    compareStableString
  );
  for (const key of keys) {
    out[key] = canonicalizeJsonValue(
      /** @type {Record<string, unknown>} */ (value)[key],
      seen
    );
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function serializeCanonical(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

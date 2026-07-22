/**
 * CORE-13-local canonical clone + deep freeze.
 * Rejects non-replay-certified values. No wall-clock / random.
 */

import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { compareStableString } from "./compare.js";

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
  throw new RefereeAssignmentContractError(
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
    `Non-canonical value at ${path || "(root)"}: ${type}`,
    { path, type }
  );
}

/**
 * @param {unknown} value
 * @param {string} [path]
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function deepFreezeCanonical(value, path = "", seen = new WeakSet()) {
  if (value === null) {
    return null;
  }

  const t = typeof value;
  if (t === "string" || t === "boolean") {
    return value;
  }
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        `Non-finite number at ${path || "(root)"}`,
        { path, value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (
    t === "undefined" ||
    t === "function" ||
    t === "symbol" ||
    t === "bigint"
  ) {
    rejectNonCanonical(value, path);
  }

  if (t !== "object") {
    rejectNonCanonical(value, path);
  }

  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    rejectNonCanonical(value, path);
  }

  if (seen.has(/** @type {object} */ (value))) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
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

  if (!isPlainObject(value)) {
    rejectNonCanonical(value, path);
  }

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
 * @param {unknown} value
 * @param {string} path
 * @returns {Readonly<Record<string, unknown>>}
 */
export function freezePlainObject(value, path) {
  if (!isPlainObject(value) && value != null) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${path} must be a plain object`,
      { path }
    );
  }
  return /** @type {Readonly<Record<string, unknown>>} */ (
    deepFreezeCanonical(value ?? {}, path)
  );
}

/**
 * Validate that a value is JSON-canonical without freezing (throws on reject).
 * @param {unknown} value
 * @param {string} [path]
 */
export function assertCanonicalPlainValue(value, path = "") {
  deepFreezeCanonical(value, path);
}

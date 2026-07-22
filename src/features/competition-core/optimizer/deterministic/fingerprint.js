/**
 * CORE-10-local fingerprint — FNV-1a 32-bit over canonical serialization.
 * Ownership: CORE-10. Version: CORE10_FINGERPRINT_V1.
 * Not a cryptographic claim. No deep-import from other COREs.
 */

import { CORE10_FINGERPRINT_VERSION } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "./compare.js";
import { deepFreezeCanonical, isPlainObject } from "./canonicalize.js";

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
 * Canonicalize for serialization (owned clone; does not mutate input).
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeJsonValue(value, seen = new WeakSet()) {
  // Reuse deepFreezeCanonical validation path without freezing for serialize speed:
  // build a plain structure with sorted keys.
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
        "Non-finite number in canonical serialization",
        { value: String(value) }
      );
    }
    // Normalize -0 to +0 so canonical form matches JSON.stringify behavior.
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
      `Unsupported type in canonical serialization: ${t}`,
      { type: t }
    );
  }
  if (t !== "object") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
      "Unsupported value in canonical serialization",
      { type: t }
    );
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
      "Date/Map/Set forbidden in canonical serialization",
      {}
    );
  }
  if (seen.has(/** @type {object} */ (value))) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
      "Cyclic reference in canonical serialization",
      {}
    );
  }
  seen.add(/** @type {object} */ (value));
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
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

/**
 * Hex fingerprint including algorithm version in material.
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintValue(value) {
  const material = {
    fingerprintAlgorithmVersion: CORE10_FINGERPRINT_VERSION,
    payload: canonicalizeJsonValue(value),
  };
  const serialized = JSON.stringify(material);
  return hashStringToUint32(serialized).toString(16).padStart(8, "0");
}

/**
 * Fingerprint of an already-accepted (frozen) contract value.
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintAccepted(value) {
  // Ensure owned canonical representation even if caller passes frozen object.
  deepFreezeCanonical(
    typeof value === "object" && value !== null
      ? JSON.parse(serializeCanonical(value))
      : value
  );
  return fingerprintValue(value);
}

export { CORE10_FINGERPRINT_VERSION };

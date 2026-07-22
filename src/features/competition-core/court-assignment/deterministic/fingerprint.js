/**
 * CORE-12-local fingerprint — FNV-1a 32-bit over canonical serialization.
 * Pattern mirrored from CORE-10; no optimizer import.
 */

import { CORE12_FINGERPRINT_VERSION } from "../constants/versions.js";
import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
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
      throw new CourtAssignmentContractError(
        COURT_ASSIGNMENT_REJECTION_CODE.NON_CANONICAL_VALUE,
        "Non-finite number in canonical serialization",
        { value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.NON_CANONICAL_VALUE,
      `Unsupported type in canonical serialization: ${t}`,
      { type: t }
    );
  }
  if (t !== "object") {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.NON_CANONICAL_VALUE,
      "Unsupported value in canonical serialization",
      { type: t }
    );
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.NON_CANONICAL_VALUE,
      "Date/Map/Set forbidden in canonical serialization",
      {}
    );
  }
  if (seen.has(/** @type {object} */ (value))) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.NON_CANONICAL_VALUE,
      "Cyclic reference in canonical serialization",
      {}
    );
  }
  seen.add(/** @type {object} */ (value));
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.NON_CANONICAL_VALUE,
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
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintValue(value) {
  const material = {
    fingerprintAlgorithmVersion: CORE12_FINGERPRINT_VERSION,
    payload: canonicalizeJsonValue(value),
  };
  const serialized = JSON.stringify(material);
  return hashStringToUint32(serialized).toString(16).padStart(8, "0");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintAccepted(value) {
  deepFreezeCanonical(
    typeof value === "object" && value !== null
      ? JSON.parse(serializeCanonical(value))
      : value
  );
  return fingerprintValue(value);
}

export { CORE12_FINGERPRINT_VERSION };

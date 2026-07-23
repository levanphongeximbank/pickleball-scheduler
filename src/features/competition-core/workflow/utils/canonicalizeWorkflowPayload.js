/**
 * CORE-19-local deterministic JSON canonicalization + FNV-1a fingerprint.
 * Pattern mirrored from CORE-17; no cross-CORE deep imports.
 * Does not invent wall-clock time or randomness.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";

export const WORKFLOW_PAYLOAD_FINGERPRINT_V1 =
  "competition-core.workflow.payload-fingerprint.v1";

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
export function canonicalizeWorkflowPayload(value, seen = new WeakSet()) {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
        "Non-finite number in canonical workflow payload",
        { value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      `Unsupported type in canonical workflow payload: ${t}`,
      { type: t }
    );
  }
  if (t !== "object") {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "Unsupported value in canonical workflow payload",
      { type: t }
    );
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "Date/Map/Set forbidden in canonical workflow payload",
      {}
    );
  }
  if (seen.has(/** @type {object} */ (value))) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "Cyclic reference in canonical workflow payload",
      {}
    );
  }
  seen.add(/** @type {object} */ (value));
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeWorkflowPayload(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      "Non-plain object in canonical workflow payload",
      {}
    );
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort(
    compareStableString
  );
  for (const key of keys) {
    out[key] = canonicalizeWorkflowPayload(
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
export function serializeCanonicalWorkflowPayload(value) {
  return JSON.stringify(canonicalizeWorkflowPayload(value));
}

/**
 * Stable fingerprint for logically identical payloads (key-order independent).
 * @param {unknown} value
 * @returns {string} 8-char lowercase hex
 */
export function createWorkflowPayloadFingerprint(value) {
  const material = {
    fingerprintAlgorithmVersion: WORKFLOW_PAYLOAD_FINGERPRINT_V1,
    payload: canonicalizeWorkflowPayload(value),
  };
  return hashStringToUint32(JSON.stringify(material))
    .toString(16)
    .padStart(8, "0");
}

/**
 * Deep-freeze an owned clone. Does not mutate caller input.
 * @param {unknown} value
 * @returns {unknown}
 */
export function deepFreezeClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreezeClone(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(/** @type {Record<string, unknown>} */ (value))) {
    out[key] = deepFreezeClone(
      /** @type {Record<string, unknown>} */ (value)[key]
    );
  }
  return Object.freeze(out);
}

/**
 * Shallow JSON-safe clone for plain objects/arrays (no Date/Map/Set).
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneJsonSafe(value) {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(canonicalizeWorkflowPayload(value)));
}

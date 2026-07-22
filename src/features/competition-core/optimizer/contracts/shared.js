/**
 * CORE-10 — shared contract validation helpers.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  deepFreezeCanonical,
  freezePlainObject,
  isPlainObject,
} from "../deterministic/canonicalize.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} [code]
 * @returns {string}
 */
export function requireStableId(value, field, code = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OptimizerContractError(
      code,
      `${field} must be a non-empty stable string ID`,
      { field, value: value ?? null }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} [code]
 * @returns {number}
 */
export function requireNonNegativeInt(
  value,
  field,
  code = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new OptimizerContractError(
      code,
      `${field} must be a non-negative integer`,
      { field, value: value ?? null }
    );
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} [code]
 * @returns {number}
 */
export function requirePositiveInt(
  value,
  field,
  code = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new OptimizerContractError(
      code,
      `${field} must be a positive integer`,
      { field, value: value ?? null }
    );
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} [code]
 * @returns {boolean}
 */
export function requireBoolean(
  value,
  field,
  code = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
) {
  if (typeof value !== "boolean") {
    throw new OptimizerContractError(
      code,
      `${field} must be a boolean`,
      { field, value: value ?? null }
    );
  }
  return value;
}

/**
 * Reject unknown keys against an allowlist.
 * @param {Record<string, unknown>} obj
 * @param {readonly string[]} allowed
 * @param {string} path
 * @param {string} [code]
 */
export function rejectUnknownFields(
  obj,
  allowed,
  path,
  code = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
) {
  if (!isPlainObject(obj)) {
    throw new OptimizerContractError(
      code,
      `${path} must be a plain object`,
      { path }
    );
  }
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(obj).filter((k) => !allowedSet.has(k));
  if (unknown.length > 0) {
    unknown.sort();
    throw new OptimizerContractError(
      code,
      `${path} has unknown fields: ${unknown.join(", ")}`,
      { path, unknown }
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {Readonly<Record<string, unknown>>}
 */
export function cloneFreezeObject(value, path) {
  return freezePlainObject(value ?? {}, path);
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function ownedFreeze(value) {
  return /** @type {T} */ (deepFreezeCanonical(value));
}

/**
 * Serialize a domain value for equality within decision domains.
 * @param {unknown} value
 * @returns {string}
 */
export function domainValueKey(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return `s:${value}`;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
        "Domain value must be finite",
        { value: String(value) }
      );
    }
    return `n:${value}`;
  }
  if (t === "boolean") return `b:${value}`;
  throw new OptimizerContractError(
    OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN,
    "Decision domain values must be string, number, boolean, or null",
    { type: t }
  );
}

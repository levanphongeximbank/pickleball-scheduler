/**
 * CORE-13 — shared contract validation helpers.
 */

import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { normalizeStableId } from "../deterministic/normalize.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} [code]
 * @returns {string}
 */
export function requireStableId(
  value,
  field,
  code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
) {
  return normalizeStableId(value, field, code);
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
  code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
) {
  if (typeof value !== "boolean") {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a boolean`,
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
export function requireNonNegativeInt(
  value,
  field,
  code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a non-negative integer`,
      { field, value: value ?? null }
    );
  }
  return value;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {readonly string[]} allowed
 * @param {string} path
 * @param {string} [code]
 */
export function rejectUnknownFields(
  obj,
  allowed,
  path,
  code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
) {
  if (!isPlainObject(obj)) {
    throw new RefereeAssignmentContractError(
      code,
      `${path} must be a plain object`,
      { path }
    );
  }
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(obj).filter((k) => !allowedSet.has(k));
  if (unknown.length > 0) {
    unknown.sort();
    throw new RefereeAssignmentContractError(
      code,
      `${path} has unknown fields: ${unknown.join(", ")}`,
      { path, unknown }
    );
  }
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
 * Optional ISO-8601-like bound string (opaque schedule instant). No Date parsing.
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function normalizeOptionalInstant(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} must be a string instant or null`,
      { field }
    );
  }
  if (value instanceof Date) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} must not be a Date object`,
      { field }
    );
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {ReadonlySet<string>} allowed
 * @param {string} [code]
 * @returns {string}
 */
export function requireEnum(
  value,
  field,
  allowed,
  code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a known enum value`,
      { field, value: value ?? null }
    );
  }
  return value;
}

/**
 * Canonical metadata: plain object only, deep-frozen.
 * @param {unknown} value
 * @param {string} path
 * @returns {Readonly<Record<string, unknown>>}
 */
export function normalizeMetadata(value, path = "metadata") {
  if (value == null) return ownedFreeze({});
  if (!isPlainObject(value)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${path} must be a plain object`,
      { path }
    );
  }
  return ownedFreeze(value);
}

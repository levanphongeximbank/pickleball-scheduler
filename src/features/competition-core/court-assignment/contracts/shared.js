/**
 * CORE-12 — shared contract validation helpers.
 */

import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
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
export function requireStableId(
  value,
  field,
  code = COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST
) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CourtAssignmentContractError(
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
 * @returns {boolean}
 */
export function requireBoolean(
  value,
  field,
  code = COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST
) {
  if (typeof value !== "boolean") {
    throw new CourtAssignmentContractError(
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
 * @param {number} [fallback]
 * @returns {number}
 */
export function requireFiniteNumber(value, field, fallback) {
  if (value == null && fallback !== undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
      `${field} must be a finite number`,
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
  code = COURT_ASSIGNMENT_REJECTION_CODE.UNKNOWN_FIELD
) {
  if (!isPlainObject(obj)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
      `${path} must be a plain object`,
      { path }
    );
  }
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(obj).filter((k) => !allowedSet.has(k));
  if (unknown.length > 0) {
    unknown.sort();
    throw new CourtAssignmentContractError(
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
 * @param {unknown} value
 * @param {readonly string[]} allowed
 * @param {string} field
 * @param {string} [code]
 * @returns {string}
 */
export function requireEnum(
  value,
  allowed,
  field,
  code = COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST
) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new CourtAssignmentContractError(
      code,
      `${field} must be one of: ${allowed.join(", ")}`,
      { field, value: value ?? null, allowed: [...allowed] }
    );
  }
  return value;
}

/**
 * Minimal IANA-like timezone string (non-empty; no host defaulting).
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireTimezone(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.TIMEZONE_REQUIRED,
      `${field} must be a non-empty IANA timezone string`,
      { field, value: value ?? null }
    );
  }
  const tz = value.trim();
  if (/\s/.test(tz) || tz.includes(" ")) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.TIMEZONE_REQUIRED,
      `${field} must not contain whitespace`,
      { field, value: tz }
    );
  }
  return tz;
}

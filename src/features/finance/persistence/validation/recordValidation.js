/**
 * Shared persistence record field validation (Phase 1E).
 * Rejects malformed stored data — never silently repairs corruption.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { assertMinorAmount } from "../../domain/money.js";
import { requireSupportedCurrency } from "../../domain/currency.js";
import { normalizePersistenceSafeMetadata } from "./safeMetadata.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {never}
 */
export function throwPersistenceInvalid(code, message, context) {
  throw new FinanceError(code, message, context);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireRecordId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {string|null}
 */
export function optionalRecordId(value, field = "optionalId") {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `${field} must be a non-empty string when provided.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireTenantId(value, field = "tenantId") {
  return requireRecordId(value, field);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function requireOptimisticVersion(value, field = "version") {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `${field} must be a positive safe integer.`,
      { field, received: value }
    );
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function requireSafeMinorAmount(value, field = "amountMinor") {
  try {
    return assertMinorAmount(value);
  } catch (err) {
    if (err instanceof FinanceError) {
      throwPersistenceInvalid(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        `${field} must be a safe integer minor amount.`,
        { field, causeCode: err.code }
      );
    }
    throw err;
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireCanonicalCurrency(value, field = "currency") {
  if (value == null || typeof value !== "string") {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `${field} is required.`,
      { field }
    );
  }
  if (value !== value.toUpperCase()) {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `${field} must be canonical uppercase ISO-4217.`,
      { field, received: value }
    );
  }
  try {
    return requireSupportedCurrency(value);
  } catch (err) {
    if (err instanceof FinanceError) {
      throwPersistenceInvalid(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        `${field} is unsupported or invalid.`,
        { field, received: value, causeCode: err.code }
      );
    }
    throw err;
  }
}

/**
 * @param {unknown} value
 * @param {readonly string[]} allowed
 * @param {string} field
 * @returns {string}
 */
export function requireKnownStatus(value, allowed, field = "status") {
  const status = requireRecordId(value, field);
  if (!allowed.includes(status)) {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `Unknown ${field} value: ${status}.`,
      { field, received: status }
    );
  }
  return status;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireIsoTimestamp(value, field) {
  const raw = requireRecordId(value, field);
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field }
    );
  }
  return new Date(ms).toISOString();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function optionalIsoTimestamp(value, field) {
  if (value == null || value === "") return null;
  return requireIsoTimestamp(value, field);
}

/**
 * Deterministic deep sort for JSON serialization.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeysDeep(/** @type {Record<string, unknown>} */ (value)[key]);
    }
    return out;
  }
  return value;
}

/**
 * @param {object} record
 * @returns {string}
 */
export function serializeRecordDeterministically(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throwPersistenceInvalid(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Record must be a plain object for serialization."
    );
  }
  return JSON.stringify(sortKeysDeep(record));
}

/**
 * @param {unknown} metadata
 * @returns {Readonly<Record<string, string>>|null}
 */
export function requireSafeMetadata(metadata) {
  return normalizePersistenceSafeMetadata(metadata);
}

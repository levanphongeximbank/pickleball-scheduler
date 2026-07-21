import {
  createSeedingDomainError,
  SeedingDomainError,
} from "../errors/SeedingDomainError.js";
import { SEEDING_ERROR_CODE } from "../errors/seedingErrorCodes.js";

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeOpaqueId(value) {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value);
  // Trim only — never case-fold opaque IDs (doc 10 string rules).
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function coerceFiniteNumberOrMissing(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Explicit invalid numeric (NaN / Infinity) when a value was provided.
 * Distinguishes missing (absent/null) from invalid (doc 08 + Owner Phase 1C).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExplicitNonFiniteNumber(value) {
  if (typeof value === "number") {
    return !Number.isFinite(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isNaN(n) || n === Infinity || n === -Infinity;
  }
  return false;
}

/** Canonical ISO-8601 UTC with mandatory Z (doc 10 §4.7). */
const ISO_UTC_Z_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/**
 * @typedef {{ form: 'epochMs', value: number } | { form: 'isoUtc', value: string }} NormalizedTimestamp
 */

/**
 * @param {unknown} value
 * @param {string} [fieldName]
 * @returns {NormalizedTimestamp|null}
 */
export function normalizeExplicitTimestamp(value, fieldName = "timestamp") {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.INVALID_CANDIDATE,
        `Invalid ${fieldName}: non-finite epoch milliseconds`,
        { details: { field: fieldName, value } }
      );
    }
    return Object.freeze({ form: "epochMs", value });
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!ISO_UTC_Z_RE.test(trimmed)) {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
        `Invalid ${fieldName}: require epoch ms or ISO-8601 UTC with Z`,
        { details: { field: fieldName, value: trimmed } }
      );
    }
    return Object.freeze({ form: "isoUtc", value: trimmed });
  }
  throw createSeedingDomainError(
    SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
    `Invalid ${fieldName}: unsupported timestamp form`,
    { details: { field: fieldName, typeof: typeof value } }
  );
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function throwSeedingError(code, message, details) {
  throw createSeedingDomainError(code, message, { details });
}

export { SeedingDomainError, createSeedingDomainError, SEEDING_ERROR_CODE };

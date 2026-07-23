/**
 * Persistence-safe metadata and evidence redaction helpers (Phase 1E).
 * Rejects secrets and unrestricted personal / provider payloads.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";

const SECRET_KEY_RE =
  /(secret|password|token|authorization|api[_-]?key|private[_-]?key|webhook|credential|cvv|card[_-]?number|pan)/i;

const FORBIDDEN_META_KEYS = Object.freeze([
  "secret",
  "password",
  "token",
  "authorization",
  "authorizationHeader",
  "apiKey",
  "webhookSecret",
  "credentials",
  "rawProviderPayload",
  "rawPayload",
  "providerRawResponse",
  "personalProfile",
  "fullName",
  "email",
  "phone",
  "dateOfBirth",
  "cardNumber",
  "cvv",
  "ssn",
]);

export const MAX_SAFE_METADATA_ENTRIES = 16;
export const MAX_SAFE_METADATA_VALUE_CHARS = 256;

/**
 * @param {unknown} metadata
 * @returns {Readonly<Record<string, string>>|null}
 */
export function normalizePersistenceSafeMetadata(metadata) {
  if (metadata == null) return null;
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Safe metadata must be a plain object when provided.",
      { field: "metadata" }
    );
  }

  const entries = Object.entries(metadata);
  if (entries.length > MAX_SAFE_METADATA_ENTRIES) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `Safe metadata may contain at most ${MAX_SAFE_METADATA_ENTRIES} entries.`,
      { field: "metadata" }
    );
  }

  /** @type {Record<string, string>} */
  const out = {};
  for (const [rawKey, rawValue] of entries) {
    if (typeof rawKey !== "string" || !rawKey.trim()) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        "Safe metadata keys must be non-empty strings.",
        { field: "metadata" }
      );
    }
    const key = rawKey.trim();
    if (FORBIDDEN_META_KEYS.includes(key) || SECRET_KEY_RE.test(key)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        `Safe metadata must not include forbidden field: ${key}.`,
        { field: key }
      );
    }
    if (rawValue == null) continue;
    if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        "Safe metadata values must be string, number, or boolean.",
        { field: key }
      );
    }
    const asString = String(rawValue);
    if (asString.length > MAX_SAFE_METADATA_VALUE_CHARS) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        `Safe metadata value for ${key} exceeds max length.`,
        { field: key }
      );
    }
    if (SECRET_KEY_RE.test(asString)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        `Safe metadata value for ${key} looks secret-bearing.`,
        { field: key }
      );
    }
    out[key] = asString;
  }

  return Object.freeze(out);
}

/**
 * Deep-clone plain JSON-compatible values and reject nested secrets.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @returns {unknown}
 */
export function assertNoSecretBearingValue(value, path = "value") {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "string" && SECRET_KEY_RE.test(value) && value.length < 64) {
      // Short secret-like tokens in values are rejected; long opaque refs are allowed.
      if (/^(sk_|pk_|Bearer\s)/i.test(value) || SECRET_KEY_RE.test(path)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
          `Value at ${path} must not contain secret-bearing material.`,
          { field: path }
        );
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => assertNoSecretBearingValue(item, `${path}[${i}]`));
  }
  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_META_KEYS.includes(key) || SECRET_KEY_RE.test(key)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
          `Field ${path}.${key} is forbidden in persistence records.`,
          { field: key }
        );
      }
      out[key] = assertNoSecretBearingValue(child, `${path}.${key}`);
    }
    return out;
  }
  throw new FinanceError(
    FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
    `Unsupported value type at ${path}.`,
    { field: path }
  );
}

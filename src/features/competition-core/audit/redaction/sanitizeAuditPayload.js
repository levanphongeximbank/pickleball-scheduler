/**
 * CORE-20 — prohibited / sensitive key redaction for audit payloads.
 * Does not invent wall-clock. Does not write Platform Audit.
 */

import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import {
  deepFreezeClone,
  isPlainObject,
  isNonEmptyString,
} from "../utils/helpers.js";

/** Keys never allowed in safePayload / summaries / explanationMetadata. */
export const PROHIBITED_AUDIT_KEYS = Object.freeze([
  "password",
  "currentPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "resetToken",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
  "ssn",
  "email",
  "phone",
  "phoneNumber",
]);

const PROHIBITED_KEY_SET = new Set(
  PROHIBITED_AUDIT_KEYS.map((k) => k.toLowerCase())
);

const MAX_STRING_LENGTH = 500;

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isProhibitedAuditKey(key) {
  return PROHIBITED_KEY_SET.has(String(key || "").toLowerCase());
}

/**
 * @param {unknown} value
 * @param {string[]} [redactedPaths]
 * @param {string} [path]
 * @returns {unknown}
 */
function sanitizeValue(value, redactedPaths = [], path = "") {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      redactedPaths.push(path || "$");
      return `${value.slice(0, MAX_STRING_LENGTH)}…`;
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, idx) =>
      sanitizeValue(item, redactedPaths, `${path}[${idx}]`)
    );
  }
  if (!isPlainObject(value)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_PROHIBITED_CONTENT,
      "Non-JSON-safe value in audit payload",
      { path, type: typeof value }
    );
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isProhibitedAuditKey(key)) {
      redactedPaths.push(childPath);
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitizeValue(child, redactedPaths, childPath);
  }
  return out;
}

/**
 * Sanitize an object for safe audit storage. Returns sanitized clone + markers.
 *
 * @param {unknown} payload
 * @returns {{ sanitized: Readonly<Record<string, unknown>>, redactionMetadata: Readonly<{ redacted: boolean, paths: ReadonlyArray<string> }> }}
 */
export function sanitizeAuditPayload(payload) {
  if (payload == null) {
    return {
      sanitized: Object.freeze({}),
      redactionMetadata: Object.freeze({
        redacted: false,
        paths: Object.freeze([]),
      }),
    };
  }
  if (!isPlainObject(payload)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_PROHIBITED_CONTENT,
      "Audit payload must be a plain object",
      {}
    );
  }

  /** @type {string[]} */
  const paths = [];
  const sanitized = sanitizeValue(payload, paths, "");
  return {
    sanitized: Object.freeze(
      /** @type {Record<string, unknown>} */ (deepFreezeClone(sanitized))
    ),
    redactionMetadata: Object.freeze({
      redacted: paths.length > 0,
      paths: Object.freeze([...paths]),
    }),
  };
}

/**
 * Pick allowlisted keys only (no arbitrary metadata dump).
 *
 * @param {unknown} payload
 * @param {ReadonlyArray<string>} allowlist
 * @returns {Readonly<Record<string, unknown>>}
 */
export function pickAllowlistedPayload(payload, allowlist) {
  if (!isPlainObject(payload)) {
    return Object.freeze({});
  }
  const keys = Array.isArray(allowlist) ? allowlist : [];
  /** @type {Record<string, unknown>} */
  const picked = {};
  for (const key of keys) {
    if (!isNonEmptyString(key)) continue;
    if (isProhibitedAuditKey(key)) continue;
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      picked[key] = payload[key];
    }
  }
  const { sanitized } = sanitizeAuditPayload(picked);
  return sanitized;
}

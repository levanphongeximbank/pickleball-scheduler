/**
 * Shared validation helpers for ECO-01 contracts.
 * Pure — no env, no network, no globals.
 */

import { fail, ok } from "../../../core/platform/index.js";

/**
 * @param {*} value
 * @returns {value is Record<string, *>}
 */
export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 */
export function contractError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} value
 * @param {string} field
 * @param {string} errorCode
 * @param {string} label
 */
export function requireNonEmptyString(value, field, errorCode, label) {
  if (typeof value !== "string") {
    return fail(
      contractError(errorCode, `${label} must be a string`, field)
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fail(
      contractError(errorCode, `${label} must be a non-empty string`, field)
    );
  }
  return ok(trimmed);
}

/**
 * @param {*} value
 * @param {ReadonlyArray<string>} allowed
 * @param {string} field
 * @param {string} errorCode
 * @param {string} label
 */
export function requireEnumMember(value, allowed, field, errorCode, label) {
  const stringResult = requireNonEmptyString(value, field, errorCode, label);
  if (!stringResult.ok) return stringResult;
  if (!allowed.includes(stringResult.value)) {
    return fail(
      contractError(
        errorCode,
        `${label} must be one of: ${allowed.join(", ")}`,
        field
      )
    );
  }
  return stringResult;
}

/**
 * @param {*} value
 * @param {string} field
 * @param {string} errorCode
 */
export function requireBoolean(value, field, errorCode) {
  if (typeof value !== "boolean") {
    return fail(
      contractError(errorCode, `${field} must be a boolean`, field)
    );
  }
  return ok(value);
}

/**
 * @param {*} value
 * @param {string} field
 * @param {string} errorCode
 * @param {string} label
 */
export function requireStringArray(value, field, errorCode, label) {
  if (!Array.isArray(value)) {
    return fail(
      contractError(errorCode, `${label} must be an array`, field)
    );
  }
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== "string" || item.trim().length === 0) {
      return fail(
        contractError(
          errorCode,
          `${label}[${i}] must be a non-empty string`,
          field
        )
      );
    }
    out.push(item.trim());
  }
  return ok(Object.freeze(out));
}

/**
 * ISO-8601 instant check via Platform Core.
 * @param {*} value
 * @param {string} field
 * @param {string} errorCode
 */
export function requireIsoInstant(value, field, errorCode) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(
      contractError(errorCode, `${field} must be a non-empty ISO instant`, field)
    );
  }
  const trimmed = value.trim();
  // Platform parseIsoStrict is preferred when available; local fallback stays strict-ish.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    return fail(
      contractError(errorCode, `${field} must be a valid ISO-8601 instant`, field)
    );
  }
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    return fail(
      contractError(errorCode, `${field} must be a parseable ISO instant`, field)
    );
  }
  return ok(trimmed);
}

/**
 * Opaque provider-neutral payload boundary — frozen shallow copy of plain object
 * or primitive/array deep-frozen. Rejects functions and credentials-looking keys.
 * @param {*} payload
 * @param {string} field
 * @param {string} errorCode
 */
export function normalizeOpaquePayload(payload, field, errorCode) {
  if (payload === undefined) {
    return fail(
      contractError(errorCode, `${field} is required`, field)
    );
  }
  if (typeof payload === "function") {
    return fail(
      contractError(errorCode, `${field} must not be a function`, field)
    );
  }
  if (payload !== null && typeof payload === "object") {
    const forbidden = findForbiddenCredentialKey(payload);
    if (forbidden) {
      return fail(
        contractError(
          errorCode,
          `${field} must not contain credential-like key: ${forbidden}`,
          field
        )
      );
    }
  }
  return ok(deepFreeze(cloneJsonSafe(payload)));
}

/**
 * @param {*} value
 * @returns {*}
 */
function cloneJsonSafe(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonSafe(item));
  }
  /** @type {Record<string, *>} */
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = cloneJsonSafe(item);
  }
  return out;
}

/**
 * @param {*} value
 * @param {string} [path]
 * @returns {string|null}
 */
function findForbiddenCredentialKey(value, path = "") {
  if (value === null || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findForbiddenCredentialKey(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (
      /(secret|password|token|authorization|api[_-]?key|private[_-]?key|credential)/i.test(
        key
      )
    ) {
      return next;
    }
    const hit = findForbiddenCredentialKey(item, next);
    if (hit) return hit;
  }
  return null;
}

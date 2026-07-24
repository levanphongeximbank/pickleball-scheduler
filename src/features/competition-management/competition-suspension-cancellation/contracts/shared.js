/**
 * Shared helpers for CM-07 contracts (pure, deterministic).
 * Duplicated locally to keep module boundary clear.
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionLifecycleError } from "../errors/CompetitionLifecycleError.js";
import { COMPETITION_LIFECYCLE_FINGERPRINT_ALGORITHM } from "../constants/comparison.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failContract(code, message, details) {
  throw new CompetitionLifecycleError(code, message, details);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1;
}

/**
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    const child = /** @type {Record<string|symbol, unknown>} */ (value)[key];
    if (child && typeof child === "object") {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clonePlain(value) {
  return /** @type {T} */ (JSON.parse(JSON.stringify(value)));
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareFieldPath(a, b) {
  return String(a).localeCompare(String(b), "en");
}

/**
 * Key-sorted JSON stringify for deterministic hashing.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizeJson(value) {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      /** @type {Record<string, unknown>} */
      const sorted = {};
      for (const key of Object.keys(v).sort((a, b) => a.localeCompare(b, "en"))) {
        sorted[key] = v[key];
      }
      return sorted;
    }
    return v;
  });
}

/**
 * Deterministic content fingerprint (not cryptographic).
 * @param {unknown} value
 * @returns {string}
 */
export function stableContentFingerprint(value) {
  const json = canonicalizeJson(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${COMPETITION_LIFECYCLE_FINGERPRINT_ALGORITHM.prefix}${(hash >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

/**
 * Reject control characters (C0 + DEL).
 * @param {string} value
 * @returns {boolean}
 */
export function hasControlCharacters(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Reject raw HTML/script-looking payloads in reason text.
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeHtmlOrScript(value) {
  const lower = String(value).toLowerCase();
  return (
    lower.includes("<script") ||
    lower.includes("</script") ||
    lower.includes("javascript:") ||
    /<[a-z][\s\S]*>/i.test(value)
  );
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
      `Missing or invalid required field: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * Resolve effectiveAt from explicit value or injected clock.
 * @param {unknown} explicit
 * @param {unknown} clock
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 */
export function resolveEffectiveAt(explicit, clock) {
  if (explicit != null) {
    if (typeof explicit === "string" && !Number.isNaN(Date.parse(explicit))) {
      return { ok: true, value: new Date(explicit).toISOString() };
    }
    if (typeof explicit === "number" && Number.isFinite(explicit)) {
      return { ok: true, value: new Date(explicit).toISOString() };
    }
    return { ok: false, reason: "explicit effectiveAt is not a valid timestamp" };
  }

  if (typeof clock === "function") {
    try {
      const produced = clock();
      if (typeof produced === "string" && !Number.isNaN(Date.parse(produced))) {
        return { ok: true, value: new Date(produced).toISOString() };
      }
      if (typeof produced === "number" && Number.isFinite(produced)) {
        return { ok: true, value: new Date(produced).toISOString() };
      }
      return { ok: false, reason: "clock() did not produce a valid timestamp" };
    } catch {
      return { ok: false, reason: "clock() threw" };
    }
  }

  if (typeof clock === "string" && !Number.isNaN(Date.parse(clock))) {
    return { ok: true, value: new Date(clock).toISOString() };
  }
  if (typeof clock === "number" && Number.isFinite(clock)) {
    return { ok: true, value: new Date(clock).toISOString() };
  }

  return {
    ok: false,
    reason: "effectiveAt or injected clock is required",
  };
}

/**
 * Canonical request fingerprinting for Finance application idempotency.
 *
 * Does NOT use JSON.stringify on unordered objects without normalization.
 * Secrets and raw sensitive payloads must never be included by callers.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";

const FORBIDDEN_KEY_RE =
  /(secret|password|token|authorization|api[_-]?key|private[_-]?key|rawProvider|cardNumber|cvv|ssn|email|phone|fullName|personalProfile)/i;

/**
 * @param {unknown} value
 * @param {string[]} path
 * @returns {unknown}
 */
function normalizeValue(value, path = []) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "Fingerprint values must be finite numbers.",
        { field: path.join(".") || "value" }
      );
    }
    return value;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeValue(item, [...path, String(index)]));
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of keys) {
      if (FORBIDDEN_KEY_RE.test(key)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          `Fingerprint must not include sensitive field: ${key}.`,
          { field: key }
        );
      }
      out[key] = normalizeValue(value[key], [...path, key]);
    }
    return out;
  }
  throw new FinanceError(
    FINANCE_ERROR_CODES.INVALID_INPUT,
    "Fingerprint supports only JSON-like primitives, arrays, and plain objects.",
    { field: path.join(".") || "value", type: typeof value }
  );
}

/**
 * Serialize a normalized value into a deterministic string.
 *
 * @param {unknown} value
 * @returns {string}
 */
function serializeNormalized(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeNormalized(item)).join(",")}]`;
  }
  const keys = Object.keys(value);
  return `{${keys.map((k) => `${JSON.stringify(k)}:${serializeNormalized(value[k])}`).join(",")}}`;
}

/**
 * Build a deterministic fingerprint from a canonical request object.
 *
 * @param {object} request
 * @returns {string}
 */
export function buildCanonicalRequestFingerprint(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Canonical request must be a plain object.",
      { field: "request" }
    );
  }
  const normalized = normalizeValue(request);
  return serializeNormalized(normalized);
}

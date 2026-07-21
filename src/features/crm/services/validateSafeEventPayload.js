/**
 * Safe payload validation for pending event dispatch (Phase 1F).
 * Rejects secrets, credentials, and unsafe keys.
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";

const FORBIDDEN_KEY_PATTERN =
  /^(password|secret|token|api[_-]?key|credential|authorization|private[_-]?key|access[_-]?key)$/i;

const MAX_PAYLOAD_DEPTH = 4;
const MAX_PAYLOAD_KEYS = 50;

/**
 * @param {unknown} value
 * @param {number} depth
 * @returns {{ ok: true, payload: object } | { ok: false, code: string, error: string }}
 */
export function validateSafeEventPayload(value, depth = 0) {
  if (value == null) {
    return { ok: true, payload: Object.freeze({}) };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_ENVELOPE,
      "Pending event payload must be a plain object."
    );
  }
  if (depth > MAX_PAYLOAD_DEPTH) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_ENVELOPE,
      "Pending event payload exceeds maximum nesting depth."
    );
  }

  const keys = Object.keys(value);
  if (keys.length > MAX_PAYLOAD_KEYS) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_ENVELOPE,
      "Pending event payload exceeds maximum key count."
    );
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of keys) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_ENVELOPE,
        `Pending event payload contains forbidden key: ${key}`
      );
    }
    const raw = value[key];
    if (raw == null) {
      out[key] = null;
      continue;
    }
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      out[key] = raw;
      continue;
    }
    if (Array.isArray(raw)) {
      if (raw.some((item) => item != null && typeof item === "object")) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_ENVELOPE,
          "Pending event payload arrays must contain scalar values only."
        );
      }
      out[key] = Object.freeze([...raw]);
      continue;
    }
    if (typeof raw === "object") {
      const nested = validateSafeEventPayload(raw, depth + 1);
      if (!nested.ok) return nested;
      out[key] = nested.payload;
      continue;
    }
    return crmFailure(
      CRM_ERROR_CODES.INVALID_ENVELOPE,
      `Pending event payload value for ${key} has unsupported type.`
    );
  }

  return { ok: true, payload: Object.freeze(out) };
}

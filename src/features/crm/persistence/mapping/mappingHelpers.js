/**
 * Shared persistence mapping helpers (Phase 1G).
 * Explicit field maps only — no implicit camelCase/snake_case magic.
 */

import { CRM_ERROR_CODES, CrmError } from "../../constants/errorCodes.js";
import { normalizeIsoTimestamp } from "../../constants/timestamps.js";
import { createTenantVenueScope } from "../../models/scope.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireMappedString(value, field) {
  const text = value == null ? "" : String(value).trim();
  if (!text) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `Missing mandatory persistence field: ${field}`
    );
  }
  return text;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireMappedTimestamp(value, field) {
  const iso = normalizeIsoTimestamp(value);
  if (!iso) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `Missing or invalid timestamp field: ${field}`
    );
  }
  return iso;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function mapOptionalTimestamp(value) {
  if (value == null || value === "") return null;
  return normalizeIsoTimestamp(value);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function mapOptionalString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

/**
 * Clone JSON object payload defensively; reject non-objects.
 * @param {unknown} value
 * @returns {object}
 */
export function cloneJsonObject(value) {
  if (value == null) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new CrmError(
          CRM_ERROR_CODES.INVALID_INPUT,
          "payload_json must be a JSON object."
        );
      }
      return JSON.parse(JSON.stringify(parsed));
    } catch (err) {
      if (err instanceof CrmError) throw err;
      throw new CrmError(
        CRM_ERROR_CODES.INVALID_INPUT,
        "payload_json must be valid JSON object."
      );
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "payload_json must be a JSON object."
    );
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} scopeInput
 * @returns {{ tenantId: string, venueId: string }}
 */
export function requireMappedScope(scopeInput) {
  return createTenantVenueScope(scopeInput);
}

/**
 * Normalize tag display name for persistence uniqueness/indexing.
 * @param {string} name
 * @returns {string}
 */
export function normalizeTagName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

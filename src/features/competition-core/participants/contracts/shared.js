/** Canonical schema version for Phase 2B.2 participant contracts. */
export const PARTICIPANT_SCHEMA_VERSION = "1";

/**
 * @typedef {Object} AuditMetadata
 * @property {string|null} [createdAt]
 * @property {string|null} [createdBy]
 * @property {string|null} [updatedAt]
 * @property {string|null} [updatedBy]
 * @property {string|null} [decidedAt]
 * @property {string|null} [decidedBy]
 */

/**
 * @typedef {Object} FormatExtension
 * @property {string} formatKey
 * @property {Record<string, unknown>} payload
 */

/**
 * @param {Partial<AuditMetadata>|null|undefined} partial
 * @returns {AuditMetadata}
 */
export function createAuditMetadata(partial = {}) {
  return {
    createdAt: partial?.createdAt ?? null,
    createdBy: partial?.createdBy ?? null,
    updatedAt: partial?.updatedAt ?? null,
    updatedBy: partial?.updatedBy ?? null,
    decidedAt: partial?.decidedAt ?? null,
    decidedBy: partial?.decidedBy ?? null,
  };
}

/**
 * @param {Partial<FormatExtension>|null|undefined} partial
 * @returns {FormatExtension|null}
 */
export function createFormatExtension(partial) {
  if (!partial || typeof partial !== "object") {
    return null;
  }
  return {
    formatKey: String(partial.formatKey || ""),
    payload:
      partial.payload && typeof partial.payload === "object" && !Array.isArray(partial.payload)
        ? { ...partial.payload }
        : {},
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Deep-clone JSON-safe values. Throws programmer error if not JSON-safe.
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isJsonSafe(value) {
  try {
    JSON.parse(JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSchemaVersionV1(value) {
  return value === PARTICIPANT_SCHEMA_VERSION || value === 1 || value === "1.0";
}

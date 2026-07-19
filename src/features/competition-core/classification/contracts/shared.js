/** Core-04 classification schema version. */
export const CLASSIFICATION_SCHEMA_VERSION = "1";

/**
 * @typedef {Object} ClassificationAuditMetadata
 * @property {string|null} [createdAt]
 * @property {string|null} [createdBy]
 * @property {string|null} [updatedAt]
 * @property {string|null} [updatedBy]
 * @property {string|null} [decidedAt]
 * @property {string|null} [decidedBy]
 * @property {string|null} [reason]
 */

/**
 * @typedef {Object} ClassificationFormatExtension
 * @property {string} formatKey
 * @property {Record<string, unknown>} payload
 */

/**
 * @param {Partial<ClassificationAuditMetadata>|null|undefined} partial
 * @returns {ClassificationAuditMetadata}
 */
export function createAuditMetadata(partial = {}) {
  return {
    createdAt: partial?.createdAt ?? null,
    createdBy: partial?.createdBy ?? null,
    updatedAt: partial?.updatedAt ?? null,
    updatedBy: partial?.updatedBy ?? null,
    decidedAt: partial?.decidedAt ?? null,
    decidedBy: partial?.decidedBy ?? null,
    reason: partial?.reason ?? null,
  };
}

/**
 * @param {Partial<ClassificationFormatExtension>|null|undefined} partial
 * @returns {ClassificationFormatExtension|null}
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
 * @returns {unknown}
 */
export function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

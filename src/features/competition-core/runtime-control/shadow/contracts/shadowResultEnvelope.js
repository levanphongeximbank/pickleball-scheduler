/**
 * Shadow result envelope contract (Phase 3A.2).
 * Holds injected / fixture results — no real executor dispatch.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";

/**
 * @typedef {Object} ShadowErrorDescriptor
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} ShadowResultEnvelope
 * @property {unknown} legacyResult
 * @property {unknown} canonicalResult
 * @property {ShadowErrorDescriptor|null} legacyError
 * @property {ShadowErrorDescriptor|null} canonicalError
 * @property {number|null} legacyDurationMs
 * @property {number|null} canonicalDurationMs
 * @property {Record<string, unknown>} executionMetadata
 */

/**
 * @param {unknown} value
 * @returns {ShadowErrorDescriptor|null}
 */
function normalizeError(value) {
  if (!isPlainObject(value)) return null;
  return {
    code: typeof value.code === "string" ? value.code : "UNKNOWN",
    message: typeof value.message === "string" ? value.message : "",
    metadata: isPlainObject(value.metadata) ? cloneJsonSafe(value.metadata) : {},
  };
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeDuration(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * @param {Partial<ShadowResultEnvelope>|null|undefined} partial
 * @returns {ShadowResultEnvelope}
 */
export function createShadowResultEnvelope(partial = {}) {
  return {
    legacyResult:
      partial?.legacyResult === undefined
        ? null
        : cloneJsonSafe(partial.legacyResult),
    canonicalResult:
      partial?.canonicalResult === undefined
        ? null
        : cloneJsonSafe(partial.canonicalResult),
    legacyError: normalizeError(partial?.legacyError),
    canonicalError: normalizeError(partial?.canonicalError),
    legacyDurationMs: normalizeDuration(partial?.legacyDurationMs),
    canonicalDurationMs: normalizeDuration(partial?.canonicalDurationMs),
    executionMetadata: isPlainObject(partial?.executionMetadata)
      ? cloneJsonSafe(partial.executionMetadata)
      : {},
  };
}

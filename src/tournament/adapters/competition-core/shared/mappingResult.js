/**
 * Phase 2B.3 — mapping result contract for format adapters.
 * Business-invalid data returns success:false; does not throw.
 */

import { PARTICIPANT_SCHEMA_VERSION } from "../../../../features/competition-core/index.js";
import { hasMappingErrors } from "./diagnostics.js";

/**
 * @typedef {Object} MappingSourceRef
 * @property {string} type
 * @property {string|null} id
 * @property {string} version
 */

/**
 * @typedef {Object} MappingResult
 * @property {boolean} success
 * @property {unknown|null} value
 * @property {import('./diagnostics.js').MappingDiagnostic[]} diagnostics
 * @property {MappingSourceRef} source
 * @property {string|number} targetSchemaVersion
 */

/**
 * Deep-freeze is intentionally avoided — callers receive plain JSON-safe clones.
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneSourceSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {Object} input
 * @returns {MappingResult}
 */
export function createMappingSuccess(input = {}) {
  return {
    success: true,
    value: input.value ?? null,
    diagnostics: Array.isArray(input.diagnostics) ? [...input.diagnostics] : [],
    source: {
      type: String(input.source?.type || input.sourceType || "unknown"),
      id: input.source?.id != null ? String(input.source.id) : input.sourceId != null ? String(input.sourceId) : null,
      version: String(input.source?.version || input.sourceVersion || "legacy"),
    },
    targetSchemaVersion: input.targetSchemaVersion ?? PARTICIPANT_SCHEMA_VERSION,
  };
}

/**
 * @param {Object} input
 * @returns {MappingResult}
 */
export function createMappingFailure(input = {}) {
  return {
    success: false,
    value: null,
    diagnostics: Array.isArray(input.diagnostics) ? [...input.diagnostics] : [],
    source: {
      type: String(input.source?.type || input.sourceType || "unknown"),
      id: input.source?.id != null ? String(input.source.id) : input.sourceId != null ? String(input.sourceId) : null,
      version: String(input.source?.version || input.sourceVersion || "legacy"),
    },
    targetSchemaVersion: input.targetSchemaVersion ?? PARTICIPANT_SCHEMA_VERSION,
  };
}

/**
 * Finalize: any error-severity diagnostic forces failure.
 * @param {Object} input
 * @returns {MappingResult}
 */
export function finalizeMappingResult(input = {}) {
  const diagnostics = Array.isArray(input.diagnostics) ? [...input.diagnostics] : [];
  if (hasMappingErrors(diagnostics) || input.success === false) {
    return createMappingFailure({ ...input, diagnostics });
  }
  return createMappingSuccess({ ...input, diagnostics });
}

/**
 * Assert source was not mutated (shallow + JSON equality).
 * @param {unknown} before
 * @param {unknown} after
 * @returns {boolean}
 */
export function assertSourceUnchanged(before, after) {
  return JSON.stringify(before) === JSON.stringify(after);
}

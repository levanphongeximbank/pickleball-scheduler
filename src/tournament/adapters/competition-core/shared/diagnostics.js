/**
 * Phase 2B.3 — stable format-adapter diagnostic codes and builders.
 * Machine identifiers are codes; messages are human-readable only.
 */

export const MAPPING_DIAGNOSTIC_CODE = Object.freeze({
  MISSING_SOURCE_ID: "MISSING_SOURCE_ID",
  UNSUPPORTED_SOURCE_TYPE: "UNSUPPORTED_SOURCE_TYPE",
  INVALID_IDENTITY_REFERENCE: "INVALID_IDENTITY_REFERENCE",
  MISSING_COMPETITION_ID: "MISSING_COMPETITION_ID",
  AMBIGUOUS_PERSON_ID: "AMBIGUOUS_PERSON_ID",
  UNRESOLVED_PLAYER_REFERENCE: "UNRESOLVED_PLAYER_REFERENCE",
  DUPLICATE_ACTIVE_ENTRY: "DUPLICATE_ACTIVE_ENTRY",
  INVALID_ROSTER_STATE: "INVALID_ROSTER_STATE",
  INVALID_LINEUP_REVISION: "INVALID_LINEUP_REVISION",
  MISSING_DIVISION_REFERENCE: "MISSING_DIVISION_REFERENCE",
  MISSING_CATEGORY_REFERENCE: "MISSING_CATEGORY_REFERENCE",
  SNAPSHOT_INCOMPLETE: "SNAPSHOT_INCOMPLETE",
  UNSUPPORTED_FORMAT_POLICY: "UNSUPPORTED_FORMAT_POLICY",
});

export const MAPPING_DIAGNOSTIC_SEVERITY = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
});

/**
 * @typedef {Object} MappingDiagnostic
 * @property {string} code
 * @property {string} path
 * @property {string} message
 * @property {string} severity
 * @property {string|null} [sourceType]
 * @property {string|null} [sourceId]
 * @property {unknown} [sourceValue]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Object} input
 * @returns {MappingDiagnostic}
 */
export function createMappingDiagnostic(input = {}) {
  return {
    code: String(input.code || ""),
    path: String(input.path ?? ""),
    message: String(input.message || ""),
    severity: String(input.severity || MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    sourceType: input.sourceType != null ? String(input.sourceType) : null,
    sourceId: input.sourceId != null ? String(input.sourceId) : null,
    sourceValue: input.sourceValue !== undefined ? input.sourceValue : null,
    metadata:
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? { ...input.metadata }
        : {},
  };
}

/**
 * @param {MappingDiagnostic[]} diagnostics
 * @returns {boolean}
 */
export function hasMappingErrors(diagnostics = []) {
  return diagnostics.some((d) => d && d.severity === MAPPING_DIAGNOSTIC_SEVERITY.ERROR);
}

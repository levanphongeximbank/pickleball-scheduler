/**
 * Decision diagnostics (Phase 3A.1).
 */

export const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  BLOCKER: "BLOCKER",
});

export const DIAGNOSTIC_SEVERITY_VALUES = Object.freeze(
  Object.values(DIAGNOSTIC_SEVERITY)
);

/**
 * @typedef {Object} RuntimeDiagnostic
 * @property {string} code
 * @property {string} severity
 * @property {string|null} path
 * @property {string} message
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<RuntimeDiagnostic>|null|undefined} partial
 * @returns {RuntimeDiagnostic}
 */
export function createRuntimeDiagnostic(partial = {}) {
  const severity = DIAGNOSTIC_SEVERITY_VALUES.includes(partial?.severity)
    ? partial.severity
    : DIAGNOSTIC_SEVERITY.INFO;
  return {
    code: typeof partial?.code === "string" ? partial.code : "UNKNOWN",
    severity,
    path: typeof partial?.path === "string" ? partial.path : null,
    message: typeof partial?.message === "string" ? partial.message : "",
    metadata:
      partial?.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : {},
  };
}

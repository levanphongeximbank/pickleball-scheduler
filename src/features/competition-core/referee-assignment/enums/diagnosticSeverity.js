/**
 * Diagnostic / failure severity for CORE-13 envelopes.
 * FATAL — request aborts
 * MATCH_RECOVERABLE — plan may continue; match yields unassigned requirement
 * WARNING — assignment accepted with note
 */

export const REFEREE_DIAGNOSTIC_SEVERITY = Object.freeze({
  FATAL: "FATAL",
  MATCH_RECOVERABLE: "MATCH_RECOVERABLE",
  WARNING: "WARNING",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_DIAGNOSTIC_SEVERITY_VALUES = new Set(
  Object.values(REFEREE_DIAGNOSTIC_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeDiagnosticSeverity(value) {
  return (
    typeof value === "string" && REFEREE_DIAGNOSTIC_SEVERITY_VALUES.has(value)
  );
}

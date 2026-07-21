/**
 * CORE-08 Phase 1B — typed adapter certification errors.
 * Capability-local. Does not modify Phase 3H placement algorithms.
 */

export const DRAW_CERTIFICATION_ERROR_CODE = Object.freeze({
  ADAPTER_INVALID_INPUT: "ADAPTER_INVALID_INPUT",
  ADAPTER_MODE_UNSUPPORTED: "ADAPTER_MODE_UNSUPPORTED",
  ADAPTER_MODE_AMBIGUOUS: "ADAPTER_MODE_AMBIGUOUS",
  ADAPTER_MODE_FORMAT_SPECIFIC: "ADAPTER_MODE_FORMAT_SPECIFIC",
  ADAPTER_CONSTRAINTS_UNSUPPORTED: "ADAPTER_CONSTRAINTS_UNSUPPORTED",
  ADAPTER_CONDITIONS_UNSUPPORTED: "ADAPTER_CONDITIONS_UNSUPPORTED",
  ADAPTER_SEED_RECALC_FORBIDDEN: "ADAPTER_SEED_RECALC_FORBIDDEN",
  ADAPTER_MISSING_IDENTITY: "ADAPTER_MISSING_IDENTITY",
  ADAPTER_MISSING_GROUP_COUNT: "ADAPTER_MISSING_GROUP_COUNT",
  ADAPTER_RESOLVE_FAILED: "ADAPTER_RESOLVE_FAILED",
  ADAPTER_HARDENING_REQUIRED: "ADAPTER_HARDENING_REQUIRED",
});

/** @type {ReadonlySet<string>} */
export const DRAW_CERTIFICATION_ERROR_CODE_VALUES = new Set(
  Object.values(DRAW_CERTIFICATION_ERROR_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDrawCertificationErrorCode(value) {
  return (
    typeof value === "string" && DRAW_CERTIFICATION_ERROR_CODE_VALUES.has(value)
  );
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 */
export function createDrawCertificationError(code, message, details = {}) {
  return {
    ok: false,
    code: isDrawCertificationErrorCode(code)
      ? code
      : DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
    message: String(message || "Draw certification adapter failed"),
    details:
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {},
    result: null,
    canonical: null,
  };
}

/**
 * @param {object} args
 */
export function createDrawCertificationOk({
  target,
  parity,
  legacyMode = null,
  phase3hMode = null,
  mappingStatus = null,
  request = null,
  canonical = null,
  legacy = null,
  acceptedDifferences = [],
  unsupportedBehavior = [],
  diagnostics = {},
}) {
  return {
    ok: true,
    code: null,
    message: null,
    details: {},
    target: String(target || ""),
    parity: String(parity || ""),
    legacyMode: legacyMode == null ? null : String(legacyMode),
    phase3hMode: phase3hMode == null ? null : String(phase3hMode),
    mappingStatus: mappingStatus == null ? null : String(mappingStatus),
    request,
    canonical,
    legacy,
    acceptedDifferences: Array.isArray(acceptedDifferences)
      ? acceptedDifferences.map((d) => String(d))
      : [],
    unsupportedBehavior: Array.isArray(unsupportedBehavior)
      ? unsupportedBehavior.map((d) => String(d))
      : [],
    diagnostics:
      diagnostics && typeof diagnostics === "object" ? { ...diagnostics } : {},
  };
}

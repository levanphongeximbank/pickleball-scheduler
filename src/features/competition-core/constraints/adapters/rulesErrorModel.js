import { RULE_ERROR_CODE } from "../ruleConstants.js";

/** CC-07 standardized runtime error codes. */
export const RULES_RUNTIME_ERROR_CODE = Object.freeze({
  RULES_V2_MAPPING_ERROR: "rules_v2_mapping_error",
  RULES_V2_CONTEXT_MISSING: "rules_v2_context_missing",
  RULES_V2_CONFLICT: "rules_v2_conflict",
  RULES_V2_EVALUATION_FAILED: "rules_v2_evaluation_failed",
  RULES_V2_UNSUPPORTED_LEGACY_RULE: "rules_v2_unsupported_legacy_rule",
  RULES_V2_DUPLICATE_DECISION: "rules_v2_duplicate_decision",
  RULES_V2_DOUBLE_COUNT_DETECTED: "rules_v2_double_count_detected",
});

export const RULES_RUNTIME_ERROR_CODES = new Set(Object.values(RULES_RUNTIME_ERROR_CODE));

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isRulesRuntimeErrorCode(code) {
  return typeof code === "string" && RULES_RUNTIME_ERROR_CODES.has(code);
}

/**
 * @param {Object} input
 * @param {string} input.code
 * @param {string} [input.message]
 * @param {Record<string, unknown>} [input.details]
 * @returns {{ code: string, message: string, details?: Record<string, unknown> }}
 */
export function createRulesRuntimeError(input = {}) {
  const code = isRulesRuntimeErrorCode(input.code)
    ? input.code
    : RULES_RUNTIME_ERROR_CODE.RULES_V2_EVALUATION_FAILED;

  return {
    code,
    message: input.message || defaultRulesRuntimeErrorMessage(code),
    details: input.details ? { ...input.details } : undefined,
  };
}

/**
 * @param {string} code
 * @returns {string}
 */
export function defaultRulesRuntimeErrorMessage(code) {
  switch (code) {
    case RULES_RUNTIME_ERROR_CODE.RULES_V2_MAPPING_ERROR:
      return "Rules V2 mapping failed for legacy payload.";
    case RULES_RUNTIME_ERROR_CODE.RULES_V2_CONTEXT_MISSING:
      return "Rules V2 context is missing required fields.";
    case RULES_RUNTIME_ERROR_CODE.RULES_V2_CONFLICT:
      return "Rules V2 detected conflicting constraints.";
    case RULES_RUNTIME_ERROR_CODE.RULES_V2_UNSUPPORTED_LEGACY_RULE:
      return "Rules V2 does not support a required legacy hard rule.";
    case RULES_RUNTIME_ERROR_CODE.RULES_V2_DUPLICATE_DECISION:
      return "Rules V2 detected duplicate decision application.";
    case RULES_RUNTIME_ERROR_CODE.RULES_V2_DOUBLE_COUNT_DETECTED:
      return "Rules V2 detected double-counted soft score.";
    case RULE_ERROR_CODE.RULES_V2_CONTEXT_MISSING:
      return "Rules V2 context is missing required fields.";
    default:
      return "Rules V2 evaluation failed.";
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isHardRulesRuntimeFailure(error) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = /** @type {{ code?: string }} */ (error).code;
  return (
    code === RULES_RUNTIME_ERROR_CODE.RULES_V2_UNSUPPORTED_LEGACY_RULE ||
    code === RULES_RUNTIME_ERROR_CODE.RULES_V2_EVALUATION_FAILED ||
    code === RULES_RUNTIME_ERROR_CODE.RULES_V2_CONFLICT
  );
}

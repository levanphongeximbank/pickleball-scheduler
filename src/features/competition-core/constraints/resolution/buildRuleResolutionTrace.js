import { RULE_RESOLUTION_REASON } from "./resolutionCodes.js";

/**
 * @typedef {Object} RuleResolutionTraceStep
 * @property {string} ruleId
 * @property {'selected'|'suppressed'|'conflict'} decision
 * @property {string} reasonCode
 * @property {number} [sourcePriority]
 * @property {string} [message]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} RuleResolutionTrace
 * @property {string} engineVersion
 * @property {boolean} enabled
 * @property {string} [operation]
 * @property {string} [scope]
 * @property {string} [evaluatedAt]
 * @property {RuleResolutionTraceStep[]} steps
 * @property {Record<string, unknown>} [meta]
 */

/**
 * Build an immutable resolution trace explaining winners and suppressions.
 *
 * @param {Object} partial
 * @param {boolean} partial.enabled
 * @param {string} [partial.engineVersion]
 * @param {string} [partial.operation]
 * @param {string} [partial.scope]
 * @param {string} [partial.evaluatedAt]
 * @param {RuleResolutionTraceStep[]} [partial.steps]
 * @param {Record<string, unknown>} [partial.meta]
 * @returns {RuleResolutionTrace}
 */
export function buildRuleResolutionTrace(partial = {}) {
  const steps = Array.isArray(partial.steps)
    ? partial.steps.map((step) => ({
        ruleId: String(step.ruleId ?? ""),
        decision: step.decision,
        reasonCode: String(step.reasonCode || RULE_RESOLUTION_REASON.SELECTED),
        sourcePriority:
          step.sourcePriority != null && Number.isFinite(Number(step.sourcePriority))
            ? Number(step.sourcePriority)
            : undefined,
        message: step.message != null ? String(step.message) : undefined,
        details: step.details && typeof step.details === "object" ? { ...step.details } : undefined,
      }))
    : [];

  return {
    engineVersion: String(partial.engineVersion || "core01-v1"),
    enabled: partial.enabled !== false,
    operation: partial.operation != null ? String(partial.operation) : undefined,
    scope: partial.scope != null ? String(partial.scope) : undefined,
    evaluatedAt: partial.evaluatedAt != null ? String(partial.evaluatedAt) : undefined,
    steps,
    meta: partial.meta && typeof partial.meta === "object" ? { ...partial.meta } : undefined,
  };
}

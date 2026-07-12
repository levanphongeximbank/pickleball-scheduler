import { evaluateCanonicalRulesRuntime } from "./rulesRuntimeOrchestrator.js";

/**
 * @typedef {Object} RulesShadowComparison
 * @property {boolean} ok
 * @property {boolean} legacyAccepted
 * @property {boolean} v2Accepted
 * @property {boolean} hardMismatch
 * @property {number} softScoreDifference
 * @property {boolean} reasonCodeDifference
 * @property {boolean} warningDifference
 * @property {string[]} unsupportedRules
 * @property {boolean} contextMissing
 * @property {boolean} duplicateDecision
 * @property {boolean} doubleCountDetected
 */

/**
 * @param {Object} input
 * @param {boolean} input.legacyAccepted
 * @param {boolean} input.v2Accepted
 * @param {number} [input.legacySoftScore]
 * @param {number} [input.v2SoftScore]
 * @param {string[]} [input.legacyReasonCodes]
 * @param {string[]} [input.v2ReasonCodes]
 * @param {string[]} [input.legacyWarnings]
 * @param {string[]} [input.v2Warnings]
 * @param {string[]} [input.unsupportedRules]
 * @param {boolean} [input.contextMissing]
 * @param {boolean} [input.duplicateDecision]
 * @param {boolean} [input.doubleCountDetected]
 * @returns {RulesShadowComparison}
 */
export function buildRulesShadowComparison(input = {}) {
  const legacyAccepted = input.legacyAccepted !== false;
  const v2Accepted = input.v2Accepted !== false;
  const legacySoft = Number(input.legacySoftScore ?? 0);
  const v2Soft = Number(input.v2SoftScore ?? 0);
  const legacyReasons = input.legacyReasonCodes || [];
  const v2Reasons = input.v2ReasonCodes || [];
  const legacyWarnings = input.legacyWarnings || [];
  const v2Warnings = input.v2Warnings || [];

  const hardMismatch = legacyAccepted !== v2Accepted;
  const softScoreDifference = Math.abs(legacySoft - v2Soft);
  const reasonCodeDifference =
    legacyReasons.slice().sort().join("|") !== v2Reasons.slice().sort().join("|");
  const warningDifference =
    legacyWarnings.slice().sort().join("|") !== v2Warnings.slice().sort().join("|");

  return {
    ok:
      !hardMismatch &&
      !input.contextMissing &&
      !input.duplicateDecision &&
      !input.doubleCountDetected &&
      !(input.unsupportedRules || []).length,
    legacyAccepted,
    v2Accepted,
    hardMismatch,
    softScoreDifference,
    reasonCodeDifference,
    warningDifference,
    unsupportedRules: input.unsupportedRules || [],
    contextMissing: input.contextMissing === true,
    duplicateDecision: input.duplicateDecision === true,
    doubleCountDetected: input.doubleCountDetected === true,
  };
}

/**
 * Memoized single legacy executor for side-effect safety.
 *
 * @param {() => unknown} legacyExecutor
 */
export function createMemoizedRulesExecutor(legacyExecutor) {
  let invoked = false;
  let cached;

  return {
    run() {
      if (invoked) {
        return { result: cached, invocationCount: 1, sideEffectSafe: false, duplicateDecision: true };
      }
      invoked = true;
      cached = legacyExecutor();
      return { result: cached, invocationCount: 1, sideEffectSafe: true, duplicateDecision: false };
    },
  };
}

/**
 * @param {Object} input
 * @param {string} input.consumer
 * @param {Record<string, unknown>} [input.envSource]
 * @param {() => unknown} input.legacyExecutor
 * @param {Object} input.orchestratorInput - passed to evaluateCanonicalRulesRuntime (without legacyEvaluate)
 */
export function runRulesShadowComparison(input) {
  const memo = createMemoizedRulesExecutor(input.legacyExecutor);
  const primary = memo.run();

  const bridge = evaluateCanonicalRulesRuntime({
    ...input.orchestratorInput,
    consumer: input.consumer,
    envSource: input.envSource,
    legacyEvaluate: () => primary.result,
  });

  const legacyAccepted = inferAccepted(primary.result);
  const v2Accepted = bridge.canonical ? bridge.canonical.feasible !== false : legacyAccepted;

  const comparison = buildRulesShadowComparison({
    legacyAccepted,
    v2Accepted,
    legacySoftScore: extractSoftScore(primary.result),
    v2SoftScore: bridge.canonical?.softScore,
    legacyReasonCodes: extractReasonCodes(primary.result),
    v2ReasonCodes: (bridge.canonical?.hardViolations || []).map((item) => item.reasonCode).filter(Boolean),
    legacyWarnings: extractWarnings(primary.result),
    v2Warnings: bridge.warnings,
    unsupportedRules: bridge.runtimeError?.details?.unsupportedHard || [],
    contextMissing: bridge.runtimeError?.code === "rules_v2_context_missing",
    duplicateDecision: !primary.sideEffectSafe,
    doubleCountDetected: bridge.doubleCountDetected,
  });

  return {
    primary: primary.result,
    bridge,
    comparison,
    sideEffectSafe: primary.sideEffectSafe,
    executorInvocationCount: primary.invocationCount,
    traceRecord: bridge.traceRecord,
  };
}

/**
 * @param {unknown} result
 */
function inferAccepted(result) {
  if (result == null) {
    return true;
  }
  if (typeof result === "object") {
    if ("ok" in result) {
      return /** @type {{ ok?: boolean }} */ (result).ok !== false;
    }
    if ("eligible" in result) {
      return /** @type {{ eligible?: boolean }} */ (result).eligible !== false;
    }
    if ("rejected" in result) {
      return /** @type {{ rejected?: boolean }} */ (result).rejected !== true;
    }
  }
  return true;
}

/**
 * @param {unknown} result
 */
function extractSoftScore(result) {
  if (!result || typeof result !== "object") {
    return 0;
  }
  const obj = /** @type {Record<string, unknown>} */ (result);
  if (typeof obj.score === "number") {
    return obj.score;
  }
  if (typeof obj.softScore === "number") {
    return obj.softScore;
  }
  if (typeof obj.canonicalSoftDelta === "number") {
    return obj.canonicalSoftDelta;
  }
  return 0;
}

/**
 * @param {unknown} result
 * @returns {string[]}
 */
function extractReasonCodes(result) {
  if (!result || typeof result !== "object") {
    return [];
  }
  const obj = /** @type {Record<string, unknown>} */ (result);
  const codes = [];
  if (Array.isArray(obj.hardViolations)) {
    obj.hardViolations.forEach((item) => {
      if (item && typeof item === "object" && "code" in item) {
        codes.push(String(item.code));
      }
    });
  }
  if (Array.isArray(obj.errorDetails)) {
    obj.errorDetails.forEach((item) => {
      if (item && typeof item === "object" && "reasonCode" in item) {
        codes.push(String(item.reasonCode));
      }
    });
  }
  if (typeof obj.code === "string") {
    codes.push(obj.code);
  }
  return codes;
}

/**
 * @param {unknown} result
 * @returns {string[]}
 */
function extractWarnings(result) {
  if (!result || typeof result !== "object") {
    return [];
  }
  const warnings = /** @type {{ warnings?: string[] }} */ (result).warnings;
  return Array.isArray(warnings) ? warnings : [];
}

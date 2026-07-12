import { isRulesV2Enabled } from "../../config/featureFlags.js";
import { detectConstraintConflicts } from "../detectConflicts.js";
import { evaluateCandidate } from "../evaluateCandidate.js";
import { expandApplicableRules } from "../expandApplicableRules.js";
import { normalizeRuleSet } from "../normalizeRule.js";
import { resolveContext } from "../resolveContext.js";
import { preflightRuleSet } from "../evaluateCanonicalRules.js";
import { RULE_ENGINE_VERSION } from "../ruleConstants.js";
import { createDecisionTrace, createDecisionTraceRecord } from "./decisionTrace.js";
import {
  buildCompleteRulesRuntimeTraceRecord,
  createRulesRuntimeTraceRecord,
  RULES_DECISION_STATUS,
} from "./rulesDecisionTrace.js";
import {
  createRulesRuntimeError,
  RULES_RUNTIME_ERROR_CODE,
} from "./rulesErrorModel.js";
import {
  buildDeduplicationTraceEntries,
  buildFounderShadowContributionSummary,
  deduplicateCanonicalContributions,
  detectFounderDoubleCount,
} from "./founderPolicyDeduplication.js";
import { EVALUATION_OWNER } from "./ruleEvaluationOwnership.js";

/**
 * @typedef {import('../normalizeRule.js').RuleSet} RuleSet
 * @typedef {import('../evaluateHardRules.js').RuleEvaluationContext} RuleEvaluationContext
 * @typedef {import('../../types/index.js').CandidateAssignment} CandidateAssignment
 */

/**
 * @typedef {Object} CanonicalRulesRuntimeInput
 * @property {string} consumer
 * @property {Record<string, unknown>} [legacyPayload]
 * @property {CandidateAssignment} [candidate]
 * @property {Partial<RuleEvaluationContext>} [context]
 * @property {RuleSet|Array<import('../../types/index.js').ConstraintDefinition>} [ruleSet]
 * @property {Record<string, unknown>} [envSource]
 * @property {() => unknown} [legacyEvaluate]
 * @property {(canonical: import('../../types/index.js').ConstraintEvaluationResult) => unknown} [adapt]
 * @property {string} [contextId]
 * @property {string} [candidateOrActionId]
 * @property {import('./decisionTrace.js').DecisionTrace} [trace]
 */

/**
 * @typedef {Object} CanonicalRulesRuntimeResult
 * @property {boolean} usedCanonical
 * @property {'legacy'|'canonical-orchestrator'} executionPath
 * @property {unknown} result
 * @property {unknown} legacyResult
 * @property {import('../../types/index.js').ConstraintEvaluationResult} [canonical]
 * @property {ReturnType<typeof buildCompleteRulesRuntimeTraceRecord>} traceRecord
 * @property {import('./decisionTrace.js').DecisionTrace} trace
 * @property {boolean} outputPreserved
 * @property {boolean} doubleCountDetected
 * @property {string[]} warnings
 * @property {{ code: string, message: string, details?: Record<string, unknown> }|null} [runtimeError]
 */

/**
 * Single CC-07 runtime orchestration entry.
 * Consumers must not call low-level Rules Engine functions directly when flag ON.
 *
 * @param {CanonicalRulesRuntimeInput} input
 * @returns {CanonicalRulesRuntimeResult}
 */
export function evaluateCanonicalRulesRuntime(input) {
  const trace = input.trace || createDecisionTrace();
  const envSource = input.envSource;

  if (!isRulesV2Enabled(envSource)) {
    const legacyResult = typeof input.legacyEvaluate === "function" ? input.legacyEvaluate() : null;
    const traceRecord = buildCompleteRulesRuntimeTraceRecord({
      consumer: input.consumer,
      usedCanonical: false,
      decisionStatus: RULES_DECISION_STATUS.SKIPPED,
      contextId: input.contextId,
      candidateOrActionId: input.candidateOrActionId,
    });
    const legacyTraceRecord = createDecisionTraceRecord({
      consumer: input.consumer,
      action: "legacy_fallback",
      usedCanonical: false,
      feasible: true,
      eligible: true,
      softScore: 0,
      metadata: { flag: "off" },
    });

    return {
      usedCanonical: false,
      executionPath: "legacy",
      result: legacyResult,
      legacyResult,
      traceRecord,
      trace: { records: [legacyTraceRecord], traceVersion: "cc03b-v1" },
      outputPreserved: true,
      doubleCountDetected: false,
      warnings: [],
      runtimeError: null,
    };
  }

  let ruleSet;
  let context;
  try {
    ruleSet = normalizeRuleSet(input.ruleSet || { constraints: [] });
    context = resolveContext({
      scope: input.context?.scope || "match",
      ...(input.context || {}),
    });
  } catch (error) {
    const runtimeError = createRulesRuntimeError({
      code: RULES_RUNTIME_ERROR_CODE.RULES_V2_MAPPING_ERROR,
      message: error instanceof Error ? error.message : "Rules mapping failed",
    });
    const legacyResult = typeof input.legacyEvaluate === "function" ? input.legacyEvaluate() : null;
    return buildFailureResult(input, trace, legacyResult, runtimeError);
  }

  if (!input.candidate && !input.context?.teams && !input.context?.groups && !input.context?.matchOption) {
    const runtimeError = createRulesRuntimeError({
      code: RULES_RUNTIME_ERROR_CODE.RULES_V2_CONTEXT_MISSING,
      message: "Candidate or context required for Rules V2 evaluation.",
      details: { consumer: input.consumer },
    });
    const legacyResult = typeof input.legacyEvaluate === "function" ? input.legacyEvaluate() : null;
    return buildFailureResult(input, trace, legacyResult, runtimeError);
  }

  const preflight = preflightRuleSet(ruleSet, { envSource, context });
  if (!preflight.ok) {
    const runtimeError = createRulesRuntimeError({
      code: RULES_RUNTIME_ERROR_CODE.RULES_V2_CONFLICT,
      message: "Constraint conflict detected in rule set.",
      details: { conflicts: preflight.conflicts },
    });
    const legacyResult = typeof input.legacyEvaluate === "function" ? input.legacyEvaluate() : null;
    return buildFailureResult(input, trace, legacyResult, runtimeError);
  }

  const applicable = expandApplicableRules(ruleSet.constraints, context);
  const conflicts = detectConstraintConflicts(applicable, context);
  if (conflicts.length > 0) {
    const runtimeError = createRulesRuntimeError({
      code: RULES_RUNTIME_ERROR_CODE.RULES_V2_CONFLICT,
      message: "Applicable constraint conflict detected.",
      details: { conflicts },
    });
    const legacyResult = typeof input.legacyEvaluate === "function" ? input.legacyEvaluate() : null;
    return buildFailureResult(input, trace, legacyResult, runtimeError);
  }

  const candidate = input.candidate || buildCandidateFromContext(context);
  let canonical = evaluateCandidate(candidate, ruleSet, context, { envSource });
  const deduplicationPlan = input.legacyPayload?.deduplicationPlan;
  if (deduplicationPlan?.rulesV2Enabled) {
    canonical = deduplicateCanonicalContributions(canonical, deduplicationPlan);
  }

  const legacySoftScore = Number(input.legacyPayload?.legacySoftScore ?? 0);
  const legacySuppressed = deduplicationPlan?.suppressedLegacyKeys?.length > 0;
  const doubleCountDetected =
    detectDoubleCount(canonical, input.legacyPayload) ||
    detectFounderDoubleCount({
      legacySoftScore,
      canonicalSoftScore: canonical.softScore,
      legacySuppressed,
      hardRejected: canonical.feasible === false,
    });
  const warnings = [];
  if (doubleCountDetected) {
    warnings.push("Rules V2 double-count detected between legacy and canonical soft scores.");
  }
  if (deduplicationPlan?.duplicateDetected) {
    warnings.push("Founder policy duplicate identities resolved via SKIPPED_DUPLICATE.");
  }

  const deduplicationSummary = deduplicationPlan
    ? {
        entries: buildDeduplicationTraceEntries(deduplicationPlan),
        duplicateDetected: deduplicationPlan.duplicateDetected,
        duplicateResolved: deduplicationPlan.duplicateResolved,
        legacyContributionSuppressed: legacySuppressed || deduplicationPlan.rulesV2Enabled,
        shadowContribution: buildFounderShadowContributionSummary({
          legacyContribution: legacySoftScore,
          canonicalContribution: Number(canonical.softScore ?? 0),
          legacyContributionSuppressed: legacySuppressed || deduplicationPlan.rulesV2Enabled,
          duplicateDetected: deduplicationPlan.duplicateDetected,
          duplicateResolved: deduplicationPlan.duplicateResolved,
          evaluationOwner: EVALUATION_OWNER.CANONICAL,
        }),
      }
    : undefined;

  const unsupportedHard = detectUnsupportedHardRules(input.legacyPayload, canonical);
  if (unsupportedHard.length > 0) {
    const runtimeError = createRulesRuntimeError({
      code: RULES_RUNTIME_ERROR_CODE.RULES_V2_UNSUPPORTED_LEGACY_RULE,
      message: "Unsupported legacy hard rule requires review.",
      details: { unsupportedHard },
    });
    return buildFailureResult(input, trace, null, runtimeError, canonical);
  }

  const adapted = typeof input.adapt === "function" ? input.adapt(canonical) : canonical;
  const legacyResult = adapted;
  const traceRecord = buildCompleteRulesRuntimeTraceRecord({
    consumer: input.consumer,
    usedCanonical: true,
    canonical,
    contextId: input.contextId,
    candidateOrActionId: input.candidateOrActionId,
    warnings,
    sourceMappings: deduplicationPlan?.sourceMappings || {},
    deduplicationSummary,
  });
  const legacyTraceRecord = createDecisionTraceRecord({
    consumer: input.consumer,
    action: canonical.feasible ? "score" : "reject",
    usedCanonical: true,
    feasible: canonical.feasible,
    eligible: canonical.eligible,
    softScore: canonical.softScore,
    engineVersion: canonical.engineVersion,
    ruleSetId: canonical.ruleSetId,
    ruleSetVersion: canonical.ruleSetVersion,
    explanations: canonical.explanations,
  });

  return {
    usedCanonical: true,
    executionPath: "canonical-orchestrator",
    result: adapted,
    legacyResult,
    canonical,
    traceRecord,
    trace: {
      ...trace,
      records: [...(trace.records || []), legacyTraceRecord],
    },
    outputPreserved: true,
    doubleCountDetected,
    warnings,
    runtimeError: null,
    deduplicationPlan,
    deduplicationSummary,
  };
}

/**
 * @param {Partial<RuleEvaluationContext>} context
 * @returns {CandidateAssignment}
 */
function buildCandidateFromContext(context) {
  return {
    teams: context.teams,
    groups: context.groups,
    matchOption: context.matchOption,
  };
}

/**
 * @param {CanonicalRulesRuntimeInput} input
 * @param {import('./decisionTrace.js').DecisionTrace} trace
 * @param {unknown} legacyResult
 * @param {{ code: string, message: string, details?: Record<string, unknown> }} runtimeError
 * @param {import('../../types/index.js').ConstraintEvaluationResult} [canonical]
 */
function buildFailureResult(input, trace, legacyResult, runtimeError, canonical) {
  const traceRecord = createRulesRuntimeTraceRecord({
    consumer: input.consumer,
    usedCanonical: true,
    feasible: false,
    eligible: false,
    decisionStatus: RULES_DECISION_STATUS.REQUIRES_REVIEW,
    contextId: input.contextId,
    candidateOrActionId: input.candidateOrActionId,
    warnings: [runtimeError.message],
    failedHardConstraints: [{ reasonCode: runtimeError.code, message: runtimeError.message }],
    engineVersion: RULE_ENGINE_VERSION,
  });

  return {
    usedCanonical: true,
    executionPath: "canonical-orchestrator",
    result: legacyResult,
    legacyResult,
    canonical,
    traceRecord,
    trace: {
      ...trace,
      records: [...(trace.records || []), traceRecord],
    },
    outputPreserved: legacyResult != null,
    doubleCountDetected: false,
    warnings: [runtimeError.message],
    runtimeError,
  };
}

/**
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @param {Record<string, unknown>|undefined} legacyPayload
 */
function detectDoubleCount(canonical, legacyPayload) {
  if (!legacyPayload || typeof legacyPayload !== "object") {
    return false;
  }
  const legacySoft = Number(legacyPayload.legacySoftScore ?? legacyPayload.score ?? 0);
  const canonicalSoft = Number(canonical.softScore ?? 0);
  if (!Number.isFinite(legacySoft) || legacySoft === 0 || canonicalSoft === 0) {
    return false;
  }
  return legacyPayload.applyCanonicalSoft === true && Math.abs(legacySoft - canonicalSoft) > 0.001;
}

/**
 * @param {Record<string, unknown>|undefined} legacyPayload
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 */
function detectUnsupportedHardRules(legacyPayload, canonical) {
  const required = Array.isArray(legacyPayload?.requiredHardRules)
    ? legacyPayload.requiredHardRules.map(String)
    : [];
  if (!required.length) {
    return [];
  }
  const supported = new Set(
    (canonical.explanations || [])
      .map((item) => item.reasonCode)
      .filter(Boolean)
      .map(String)
  );
  if (canonical.feasible === false) {
    return [];
  }
  return required.filter((code) => !supported.has(code));
}

export { RULES_RUNTIME_ADAPTER_VERSION } from "./rulesRuntimeInventory.js";

import { RULE_ENGINE_VERSION } from "../ruleConstants.js";
import { appendDecisionTrace, createDecisionTraceRecord } from "./decisionTrace.js";

/** @typedef {'ACCEPTED'|'REJECTED'|'SCORED'|'SKIPPED'|'CONFLICT'|'REQUIRES_REVIEW'} RulesDecisionStatus */

export const RULES_DECISION_STATUS = Object.freeze({
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  SCORED: "SCORED",
  SKIPPED: "SKIPPED",
  CONFLICT: "CONFLICT",
  REQUIRES_REVIEW: "REQUIRES_REVIEW",
});

export const RULES_RUNTIME_TRACE_VERSION = "cc07-v1";

let runtimeTraceCounter = 0;

function nextRuntimeTraceId() {
  runtimeTraceCounter += 1;
  return `rules-trace-${Date.now()}-${runtimeTraceCounter}`;
}

/**
 * @param {Object} input
 * @returns {import('./decisionTrace.js').DecisionTraceRecord & {
 *   traceId: string,
 *   engineType: string,
 *   contextId?: string,
 *   candidateOrActionId?: string,
 *   decisionStatus: RulesDecisionStatus,
 *   evaluatedConstraints: unknown[],
 *   failedHardConstraints: unknown[],
 *   softContributions: unknown[],
 *   sourceMappings: Record<string, unknown>,
 *   warnings: string[],
 *   suggestedResolution?: string,
 *   timestamp: string,
 * }}
 */
function mapDecisionStatusToLegacyAction(status) {
  switch (status) {
    case RULES_DECISION_STATUS.REJECTED:
      return "reject";
    case RULES_DECISION_STATUS.SCORED:
      return "score";
    case RULES_DECISION_STATUS.SKIPPED:
      return "legacy_fallback";
    case RULES_DECISION_STATUS.CONFLICT:
      return "conflict";
    case RULES_DECISION_STATUS.REQUIRES_REVIEW:
      return "review";
    default:
      return "evaluate";
  }
}

export function createRulesRuntimeTraceRecord(input = {}) {
  const decisionStatus = input.decisionStatus || deriveDecisionStatus(input);
  const base = createDecisionTraceRecord({
    id: input.traceId || nextRuntimeTraceId(),
    consumer: input.consumer || input.engineType || "rules_runtime",
    action: input.action || mapDecisionStatusToLegacyAction(decisionStatus),
    usedCanonical: input.usedCanonical === true,
    feasible: decisionStatus !== RULES_DECISION_STATUS.REJECTED,
    eligible: input.eligible !== false,
    softScore: Number(input.softScore ?? 0),
    engineVersion: input.engineVersion || RULE_ENGINE_VERSION,
    ruleSetId: input.ruleSetId,
    ruleSetVersion: input.ruleSetVersion,
    explanations: input.explanations || input.failedHardConstraints || [],
    metadata: input.metadata,
  });

  return {
    ...base,
    traceId: input.traceId || base.id,
    engineType: input.engineType || "rules",
    engineVersion: input.engineVersion || RULE_ENGINE_VERSION,
    ruleSetId: input.ruleSetId,
    ruleSetVersion: input.ruleSetVersion,
    contextId: input.contextId,
    candidateOrActionId: input.candidateOrActionId,
    decisionStatus,
    evaluatedConstraints: Array.isArray(input.evaluatedConstraints) ? input.evaluatedConstraints : [],
    failedHardConstraints: Array.isArray(input.failedHardConstraints) ? input.failedHardConstraints : [],
    softContributions: Array.isArray(input.softContributions) ? input.softContributions : [],
    sourceMappings: input.sourceMappings && typeof input.sourceMappings === "object" ? input.sourceMappings : {},
    deduplicationSummary: input.deduplicationSummary,
    evaluationOwner: input.evaluationOwner,
    deduplicationKey: input.deduplicationKey,
    deduplicationStatus: input.deduplicationStatus,
    legacyContributionSuppressed: input.legacyContributionSuppressed === true,
    canonicalContributionApplied: input.canonicalContributionApplied === true,
    fallbackReason: input.fallbackReason,
    warnings: Array.isArray(input.warnings) ? input.warnings : [],
    suggestedResolution: input.suggestedResolution,
    timestamp: input.timestamp || base.evaluatedAt,
  };
}

/**
 * @param {Partial<Parameters<typeof createRulesRuntimeTraceRecord>[0]>} input
 * @returns {RulesDecisionStatus}
 */
export function deriveDecisionStatus(input = {}) {
  if (input.decisionStatus) {
    return input.decisionStatus;
  }
  if (input.usedCanonical === false) {
    return RULES_DECISION_STATUS.SKIPPED;
  }
  if (input.hasConflict === true) {
    return RULES_DECISION_STATUS.CONFLICT;
  }
  if (input.feasible === false || input.eligible === false) {
    return RULES_DECISION_STATUS.REJECTED;
  }
  if (Number(input.softScore ?? 0) !== 0) {
    return RULES_DECISION_STATUS.SCORED;
  }
  return RULES_DECISION_STATUS.ACCEPTED;
}

/**
 * @param {ReturnType<typeof createRulesRuntimeTraceRecord>} record
 * @returns {boolean}
 */
export function isRulesRuntimeTraceJsonSerializable(record) {
  try {
    JSON.stringify(record);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, unknown>} record
 * @returns {Record<string, unknown>}
 */
export function redactRulesRuntimeTraceSecrets(record = {}) {
  const redacted = { ...record };
  const secretKeys = ["accessToken", "token", "password", "secret", "authorization"];
  secretKeys.forEach((key) => {
    if (key in redacted) {
      redacted[key] = "[REDACTED]";
    }
  });
  return redacted;
}

/**
 * @param {ReturnType<typeof createRulesRuntimeTraceRecord>} record
 * @returns {string[]}
 */
export function validateRulesRuntimeTraceRecord(record = {}) {
  const errors = [];
  if (!record.traceId) {
    errors.push("traceId required");
  }
  if (!record.engineType) {
    errors.push("engineType required");
  }
  if (!record.decisionStatus) {
    errors.push("decisionStatus required");
  }
  if (!record.timestamp) {
    errors.push("timestamp required");
  }
  return errors;
}

/**
 * @param {import('./decisionTrace.js').DecisionTrace} trace
 * @param {ReturnType<typeof createRulesRuntimeTraceRecord>} record
 */
export function appendRulesRuntimeTrace(trace, record) {
  return appendDecisionTrace(trace, record);
}

/**
 * @param {Object} input
 * @returns {ReturnType<typeof createRulesRuntimeTraceRecord>}
 */
export function buildCompleteRulesRuntimeTraceRecord(input = {}) {
  const canonical = input.canonical || input.bridge?.canonical;
  const failedHard = canonical?.hardViolations || input.failedHardConstraints || [];
  const softNotes = canonical?.softNotes || input.softContributions || [];

  return createRulesRuntimeTraceRecord({
    traceId: input.traceId,
    engineType: input.engineType || input.consumer || "rules_runtime",
    engineVersion: canonical?.engineVersion || input.engineVersion,
    ruleSetId: canonical?.ruleSetId || input.ruleSetId,
    ruleSetVersion: canonical?.ruleSetVersion || input.ruleSetVersion,
    contextId: input.contextId,
    candidateOrActionId: input.candidateOrActionId,
    usedCanonical: input.usedCanonical ?? input.bridge?.usedCanonical,
    feasible: canonical?.feasible ?? input.feasible,
    eligible: canonical?.eligible ?? input.eligible,
    softScore: canonical?.softScore ?? input.softScore,
    decisionStatus: input.decisionStatus,
    evaluatedConstraints: canonical?.explanations || input.evaluatedConstraints || [],
    failedHardConstraints: failedHard,
    softContributions: softNotes,
    sourceMappings: input.sourceMappings || {},
    deduplicationSummary: input.deduplicationSummary,
    evaluationOwner: input.deduplicationSummary?.shadowContribution?.evaluationOwner,
    deduplicationStatus: input.deduplicationSummary?.duplicateResolved ? "RESOLVED" : undefined,
    legacyContributionSuppressed:
      input.deduplicationSummary?.legacyContributionSuppressed === true ||
      input.deduplicationSummary?.shadowContribution?.legacyContributionSuppressed === true,
    canonicalContributionApplied: Number(canonical?.softScore ?? 0) !== 0 || failedHard.length > 0,
    warnings: input.warnings || [],
    suggestedResolution: failedHard[0]?.suggestedResolution || input.suggestedResolution,
    explanations: canonical?.explanations || [],
  });
}

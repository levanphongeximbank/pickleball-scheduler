import { STANDINGS_ENGINE_VERSION } from "../standingsConstants.js";

export const STANDINGS_RUNTIME_TRACE_VERSION = "cc08-v1";

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `standings-runtime-trace-${Date.now()}-${traceCounter}`;
}

/**
 * @param {Object} input
 */
export function createStandingsRuntimeDecisionTraceRecord(input = {}) {
  return {
    id: input.id || nextTraceId(),
    consumer: input.consumer || "standings_runtime",
    usedCanonical: input.usedCanonical === true,
    executionPath: input.executionPath || "legacy",
    traceVersion: STANDINGS_RUNTIME_TRACE_VERSION,
    engineVersion: input.engineVersion || STANDINGS_ENGINE_VERSION,
    scoringRuleId: input.scoringRuleId,
    scoringRuleVersion: input.scoringRuleVersion,
    tieBreakRuleSetId: input.tieBreakRuleSetId,
    tieBreakRuleSetVersion: input.tieBreakRuleSetVersion,
    path: Array.isArray(input.path) ? input.path : [],
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

/**
 * @param {import('../standingsTypes.js').StandingsDecisionTrace} [decisionTrace]
 * @param {ReturnType<typeof createStandingsRuntimeDecisionTraceRecord>} [runtimeRecord]
 */
export function buildCompleteStandingsTraceRecord(decisionTrace, runtimeRecord) {
  return {
    runtime: runtimeRecord || createStandingsRuntimeDecisionTraceRecord({}),
    canonical: decisionTrace || null,
    traceVersion: STANDINGS_RUNTIME_TRACE_VERSION,
  };
}

/**
 * @param {unknown} record
 */
export function isStandingsTraceJsonSerializable(record) {
  try {
    JSON.stringify(record);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, unknown>} record
 */
export function redactStandingsTraceSecrets(record = {}) {
  const redacted = { ...record };
  ["accessToken", "token", "password", "secret", "authorization", "profile"].forEach((key) => {
    if (key in redacted) {
      redacted[key] = "[REDACTED]";
    }
  });
  return redacted;
}

/**
 * @param {ReturnType<typeof buildCompleteStandingsTraceRecord>} record
 */
export function validateCompleteStandingsTraceRecord(record = {}) {
  const errors = [];
  if (!record.runtime?.id) {
    errors.push("runtime trace id required");
  }
  if (!record.canonical?.traceId) {
    errors.push("canonical traceId required");
  }
  return errors;
}

export function createStandingsRuntimeDecisionTrace() {
  return { records: [], traceVersion: STANDINGS_RUNTIME_TRACE_VERSION };
}

/**
 * @param {{ records?: Array<Record<string, unknown>> }} trace
 * @param {Record<string, unknown>} record
 */
export function appendStandingsRuntimeDecisionTrace(trace, record) {
  return {
    ...trace,
    records: [...(trace.records || []), record],
  };
}

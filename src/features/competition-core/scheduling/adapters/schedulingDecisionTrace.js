import { SCHEDULING_ENGINE_VERSION } from "../schedulingConstants.js";

export const SCHEDULING_RUNTIME_TRACE_VERSION = "cc09-v1";

let traceCounter = 0;

function nextTraceRecordId() {
  traceCounter += 1;
  return `scheduling-runtime-trace-${Date.now()}-${traceCounter}`;
}

/**
 * @returns {{ records: Array<Record<string, unknown>>, traceVersion: string }}
 */
export function createSchedulingRuntimeDecisionTrace() {
  return { records: [], traceVersion: SCHEDULING_RUNTIME_TRACE_VERSION };
}

/**
 * @param {Object} input
 */
export function createSchedulingRuntimeDecisionTraceRecord(input = {}) {
  return {
    recordId: nextTraceRecordId(),
    consumer: input.consumer || "scheduling_runtime",
    usedCanonical: input.usedCanonical === true,
    executionPath: input.executionPath || "legacy",
    traceVersion: SCHEDULING_RUNTIME_TRACE_VERSION,
    engineVersion: input.engineVersion || SCHEDULING_ENGINE_VERSION,
    path: input.path || [],
    metadata: input.metadata || {},
    timestamp: new Date().toISOString(),
  };
}

/**
 * @param {import('../schedulingTypes.js').SchedulingDecisionTrace} [decisionTrace]
 * @param {ReturnType<typeof createSchedulingRuntimeDecisionTraceRecord>} [runtimeRecord]
 */
export function buildCompleteSchedulingTraceRecord(decisionTrace, runtimeRecord) {
  return {
    traceVersion: SCHEDULING_RUNTIME_TRACE_VERSION,
    engineVersion: SCHEDULING_ENGINE_VERSION,
    canonical: decisionTrace || null,
    runtime: runtimeRecord || null,
  };
}

/**
 * @param {{ records: Array<Record<string, unknown>> }} trace
 * @param {ReturnType<typeof createSchedulingRuntimeDecisionTraceRecord>} record
 */
export function appendSchedulingRuntimeDecisionTrace(trace, record) {
  return {
    records: [...(trace?.records || []), record],
    traceVersion: SCHEDULING_RUNTIME_TRACE_VERSION,
  };
}

export function isSchedulingRuntimeTraceJsonSerializable(traceRecord) {
  try {
    JSON.stringify(traceRecord);
    return !/token|secret|password|apikey/i.test(JSON.stringify(traceRecord));
  } catch {
    return false;
  }
}

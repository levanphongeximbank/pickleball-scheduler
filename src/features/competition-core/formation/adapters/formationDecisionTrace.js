import { FORMATION_RUNTIME_ADAPTER_VERSION } from "./formationRuntimeInventory.js";

/**
 * @typedef {Object} FormationDecisionTraceStep
 * @property {string} phase
 * @property {string} label
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} FormationRuntimeDecisionTraceRecord
 * @property {string} id
 * @property {string} consumer
 * @property {boolean} usedCanonical
 * @property {string} executionPath
 * @property {FormationDecisionTraceStep[]} path
 * @property {string} engineVersion
 * @property {string} evaluatedAt
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} FormationRuntimeDecisionTrace
 * @property {FormationRuntimeDecisionTraceRecord[]} records
 * @property {string} traceVersion
 */

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `formation-trace-${Date.now()}-${traceCounter}`;
}

/**
 * @returns {FormationRuntimeDecisionTrace}
 */
export function createFormationRuntimeDecisionTrace() {
  return {
    records: [],
    traceVersion: FORMATION_RUNTIME_ADAPTER_VERSION,
  };
}

/**
 * @param {Partial<FormationRuntimeDecisionTraceRecord>} partial
 * @returns {FormationRuntimeDecisionTraceRecord}
 */
export function createFormationRuntimeDecisionTraceRecord(partial = {}) {
  return {
    id: partial.id || nextTraceId(),
    consumer: String(partial.consumer || "unknown"),
    usedCanonical: partial.usedCanonical === true,
    executionPath: String(partial.executionPath || "legacy"),
    path: Array.isArray(partial.path) ? partial.path.map((step) => ({ ...step })) : [],
    engineVersion: partial.engineVersion || FORMATION_RUNTIME_ADAPTER_VERSION,
    evaluatedAt: partial.evaluatedAt || new Date().toISOString(),
    metadata: partial.metadata ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {FormationRuntimeDecisionTrace} trace
 * @param {FormationRuntimeDecisionTraceRecord} record
 * @returns {FormationRuntimeDecisionTrace}
 */
export function appendFormationRuntimeDecisionTrace(trace, record) {
  if (!trace) {
    return {
      records: [record],
      traceVersion: FORMATION_RUNTIME_ADAPTER_VERSION,
    };
  }
  return {
    ...trace,
    records: [...(trace.records || []), record],
  };
}

/**
 * Build runtime decision path: Player → Partner → Constraint → Score → Court → Result.
 *
 * @param {Object} input
 * @param {import('../formationTypes.js').FormationRequest} [input.formationRequest]
 * @param {import('../formationTypes.js').FormationResult} [input.formationResult]
 */
export function buildFormationDecisionPath(input = {}) {
  const request = input.formationRequest || {};
  const result = input.formationResult || {};
  const firstPair = result.pairs?.[0];
  const firstCourt = result.courts?.[0];
  const constraintKinds = (request.constraints || [])
    .filter((item) => item.enabled !== false)
    .map((item) => item.kind);

  return [
    {
      phase: "player",
      label: firstPair?.playerIds?.[0] || request.players?.[0]?.id || "unknown",
      details: { playerCount: request.players?.length || 0 },
    },
    {
      phase: "partner",
      label: firstPair?.playerIds?.[1] || request.players?.[1]?.id || "unknown",
      details: { pairCount: result.pairs?.length || 0 },
    },
    {
      phase: "constraint",
      label: constraintKinds.length ? constraintKinds.join(", ") : "none",
      details: { enabled: constraintKinds.length },
    },
    {
      phase: "score",
      label: String(result.audit?.scores?.finalScore ?? result.selectedCandidate?.score ?? "n/a"),
      details: { strategy: request.policy?.strategy },
    },
    {
      phase: "court",
      label: firstCourt?.label || firstCourt?.id || "unassigned",
      details: { courtCount: result.courts?.length || 0 },
    },
    {
      phase: "result",
      label: result.ok ? "Legacy runtime result mapped" : "Formation failed",
      details: {
        teamCount: result.metadata?.teamCount ?? result.pairs?.length ?? 0,
        waitingCount: result.metadata?.waitingCount ?? 0,
      },
    },
  ];
}

/**
 * @param {FormationRuntimeDecisionTrace} trace
 * @returns {{ total: number, canonicalCount: number, last: FormationRuntimeDecisionTraceRecord|null }}
 */
export function summarizeFormationRuntimeDecisionTrace(trace) {
  const records = trace?.records || [];
  return {
    total: records.length,
    canonicalCount: records.filter((item) => item.usedCanonical).length,
    last: records.length ? records[records.length - 1] : null,
  };
}

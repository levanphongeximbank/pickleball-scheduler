import { MATCHMAKING_RUNTIME_ADAPTER_VERSION } from "./matchmakingRuntimeInventory.js";

/**
 * @typedef {Object} MatchmakingDecisionTraceStep
 * @property {string} phase
 * @property {string} label
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} MatchmakingRuntimeDecisionTraceRecord
 * @property {string} id
 * @property {string} consumer
 * @property {boolean} usedCanonical
 * @property {string} executionPath
 * @property {MatchmakingDecisionTraceStep[]} path
 * @property {string} engineVersion
 * @property {string} evaluatedAt
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} MatchmakingRuntimeDecisionTrace
 * @property {MatchmakingRuntimeDecisionTraceRecord[]} records
 * @property {string} traceVersion
 */

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `matchmaking-trace-${Date.now()}-${traceCounter}`;
}

export function createMatchmakingRuntimeDecisionTrace() {
  return { records: [], traceVersion: MATCHMAKING_RUNTIME_ADAPTER_VERSION };
}

export function createMatchmakingRuntimeDecisionTraceRecord(partial = {}) {
  return {
    id: partial.id || nextTraceId(),
    consumer: String(partial.consumer || "unknown"),
    usedCanonical: partial.usedCanonical === true,
    executionPath: String(partial.executionPath || "legacy"),
    path: Array.isArray(partial.path) ? partial.path.map((step) => ({ ...step })) : [],
    engineVersion: partial.engineVersion || MATCHMAKING_RUNTIME_ADAPTER_VERSION,
    evaluatedAt: partial.evaluatedAt || new Date().toISOString(),
    metadata: partial.metadata ? { ...partial.metadata } : undefined,
  };
}

export function appendMatchmakingRuntimeDecisionTrace(trace, record) {
  if (!trace) {
    return { records: [record], traceVersion: MATCHMAKING_RUNTIME_ADAPTER_VERSION };
  }
  return { ...trace, records: [...(trace.records || []), record] };
}

/**
 * Player → Court → Pair → Score → Waiting → Result
 */
export function buildMatchmakingDecisionPath(input = {}) {
  const request = input.matchmakingRequest || {};
  const result = input.matchmakingResult || {};
  const firstCourt = result.courts?.[0];

  return [
    {
      phase: "player",
      label: String(request.players?.length || 0),
      details: { playerCount: request.players?.length || 0 },
    },
    {
      phase: "court",
      label: firstCourt?.courtLabel || firstCourt?.courtId || "unassigned",
      details: { courtCount: result.courts?.length || 0 },
    },
    {
      phase: "pair",
      label: `${firstCourt?.teamAIds?.length || 0}v${firstCourt?.teamBIds?.length || 0}`,
      details: { strategy: request.policy?.strategy },
    },
    {
      phase: "score",
      label: String(result.scores?.finalScore ?? result.scores?.total ?? "n/a"),
      details: { competitionType: request.policy?.competitionType },
    },
    {
      phase: "waiting",
      label: String(result.waitingPlayerIds?.length || 0),
      details: { waitingCount: result.waitingPlayerIds?.length || 0 },
    },
    {
      phase: "result",
      label: result.ok ? "Legacy runtime result mapped" : "Matchmaking failed",
      details: { courtCount: result.courts?.length || 0 },
    },
  ];
}

export function summarizeMatchmakingRuntimeDecisionTrace(trace) {
  const records = trace?.records || [];
  return {
    total: records.length,
    canonicalCount: records.filter((item) => item.usedCanonical).length,
    last: records.length ? records[records.length - 1] : null,
  };
}

import { DRAW_RUNTIME_ADAPTER_VERSION } from "./drawRuntimeInventory.js";

/**
 * @typedef {Object} DrawDecisionTraceStep
 * @property {string} phase
 * @property {string} label
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} DrawDecisionTraceRecord
 * @property {string} id
 * @property {string} consumer
 * @property {boolean} usedCanonical
 * @property {string} executionPath
 * @property {DrawDecisionTraceStep[]} path
 * @property {string} engineVersion
 * @property {string} evaluatedAt
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} DrawDecisionTrace
 * @property {DrawDecisionTraceRecord[]} records
 * @property {string} traceVersion
 */

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `draw-trace-${Date.now()}-${traceCounter}`;
}

/**
 * @returns {DrawDecisionTrace}
 */
export function createDrawDecisionTrace() {
  return {
    records: [],
    traceVersion: DRAW_RUNTIME_ADAPTER_VERSION,
  };
}

/**
 * @param {Partial<DrawDecisionTraceRecord>} partial
 * @returns {DrawDecisionTraceRecord}
 */
export function createDrawDecisionTraceRecord(partial = {}) {
  return {
    id: partial.id || nextTraceId(),
    consumer: String(partial.consumer || "unknown"),
    usedCanonical: partial.usedCanonical === true,
    executionPath: String(partial.executionPath || "legacy"),
    path: Array.isArray(partial.path) ? partial.path.map((step) => ({ ...step })) : [],
    engineVersion: partial.engineVersion || DRAW_RUNTIME_ADAPTER_VERSION,
    evaluatedAt: partial.evaluatedAt || new Date().toISOString(),
    metadata: partial.metadata ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {DrawDecisionTrace} trace
 * @param {DrawDecisionTraceRecord} record
 * @returns {DrawDecisionTrace}
 */
export function appendDrawDecisionTrace(trace, record) {
  if (!trace) {
    return {
      records: [record],
      traceVersion: DRAW_RUNTIME_ADAPTER_VERSION,
    };
  }
  return {
    ...trace,
    records: [...(trace.records || []), record],
  };
}

/**
 * Build runtime decision path for canonical adapter runs.
 *
 * @param {Object} input
 * @param {import('../strategy/strategyTypes.js').StrategySelection} [input.selection]
 * @param {import('../strategy/strategyTypes.js').SeedPolicy} [input.seedPolicy]
 * @param {import('../strategy/strategyTypes.js').DistributionPolicy} [input.distributionPolicy]
 * @param {import('../strategy/strategyTypes.js').ConstraintPolicy} [input.constraintPolicy]
 * @param {import('../strategy/strategyTypes.js').BalancePolicy} [input.balancePolicy]
 * @param {import('../drawTypes.js').DrawResult} [input.drawResult]
 */
export function buildDrawDecisionPath(input = {}) {
  const path = [
    {
      phase: "strategy",
      label: input.selection?.strategy?.name || input.selection?.strategyId || "Unknown",
      details: {
        strategyId: input.selection?.strategyId,
        distributionType: input.selection?.distributionType,
      },
    },
    {
      phase: "seed",
      label: input.seedPolicy?.required ? "Seed required" : "Seed optional",
      details: {
        required: input.seedPolicy?.required === true,
        sourcePreference: input.seedPolicy?.sourcePreference,
      },
    },
    {
      phase: "distribution",
      label: input.distributionPolicy?.type || input.selection?.distributionType || "unknown",
      details: {
        deterministic: input.distributionPolicy?.deterministic,
      },
    },
    {
      phase: "constraint",
      label: input.constraintPolicy?.enabled ? "Constraints enabled" : "Constraints disabled",
      details: {
        categories: input.constraintPolicy?.categories || [],
        repairAllowed: input.constraintPolicy?.repairAllowed,
      },
    },
    {
      phase: "balance",
      label: input.balancePolicy?.enabled ? "Balance enabled" : "Balance disabled",
      details: {
        metric: input.balancePolicy?.metric,
        targetSpread: input.balancePolicy?.targetSpread,
      },
    },
    {
      phase: "final_placement",
      label: "Legacy runtime result mapped",
      details: {
        groupCount: input.drawResult?.groups?.length || 0,
        placementCount: (input.drawResult?.groups || []).reduce(
          (sum, group) => sum + (group.entryIds?.length || 0),
          0
        ),
      },
    },
  ];

  return path;
}

/**
 * @param {DrawDecisionTrace} trace
 * @returns {{ total: number, canonicalCount: number, last: DrawDecisionTraceRecord|null }}
 */
export function summarizeDrawDecisionTrace(trace) {
  const records = trace?.records || [];
  return {
    total: records.length,
    canonicalCount: records.filter((item) => item.usedCanonical).length,
    last: records.length ? records[records.length - 1] : null,
  };
}

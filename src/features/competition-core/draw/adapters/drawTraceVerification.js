import { DRAW_RUNTIME_ADAPTER_VERSION } from "./drawRuntimeInventory.js";
import { summarizeDrawDecisionTrace } from "./drawDecisionTrace.js";

/**
 * @typedef {Object} CompleteDrawTraceRecord
 * @property {string} traceId
 * @property {string|null} drawId
 * @property {string} engineVersion
 * @property {string} strategy
 * @property {string} legacyRuntime
 * @property {unknown} randomSeed
 * @property {Record<string, unknown>} seedSummary
 * @property {Record<string, unknown>} distributionSummary
 * @property {Record<string, unknown>} constraintSummary
 * @property {Record<string, unknown>} balanceSummary
 * @property {Array<Record<string, unknown>>} finalPlacements
 * @property {string[]} warnings
 * @property {string} parityStatus
 */

let drawTraceCounter = 0;

function nextDrawTraceId() {
  drawTraceCounter += 1;
  return `draw-trace-${Date.now()}-${drawTraceCounter}`;
}

/**
 * Build JSON-serializable complete draw trace for CC-04E verification.
 *
 * @param {Object} input
 * @param {import('./drawRuntimeAdapter.js').CanonicalDrawBridgeResult} [input.bridge]
 * @param {string} [input.drawId]
 * @param {string} [input.legacyRuntime]
 * @param {import('./drawShadowParity.js').DrawShadowComparison} [input.parity]
 */
export function buildCompleteDrawTraceRecord(input = {}) {
  const bridge = input.bridge || {};
  const traceRecord = bridge.trace?.records?.[bridge.trace.records.length - 1];
  const summary = summarizeDrawDecisionTrace(bridge.trace);
  const selection = bridge.strategyDrawRequest?.selection;
  const policies = {
    seed: bridge.strategyDrawRequest?.seedPolicy,
    distribution: bridge.strategyDrawRequest?.distributionPolicy,
    constraint: bridge.strategyDrawRequest?.constraintPolicy,
    balance: bridge.strategyDrawRequest?.balancePolicy,
  };

  const finalPlacements = (bridge.drawResult?.groups || []).flatMap((group, groupIndex) =>
    (group.entryIds || []).map((entryId, slotIndex) => ({
      entryId,
      groupId: group.id,
      groupIndex,
      slotIndex,
    }))
  );

  const parityStatus = input.parity
    ? input.parity.ok
      ? "parity_pass"
      : "parity_fail"
    : bridge.outputPreserved
      ? "output_preserved"
      : "unknown";

  return {
    traceId: traceRecord?.id || nextDrawTraceId(),
    drawId: input.drawId ?? bridge.drawRequest?.eventId ?? bridge.drawRequest?.tournamentId ?? null,
    engineVersion: DRAW_RUNTIME_ADAPTER_VERSION,
    strategy: selection?.strategyId || selection?.strategy?.name || "unknown",
    legacyRuntime: input.legacyRuntime || traceRecord?.consumer || "unknown",
    randomSeed:
      bridge.drawRequest?.random?.seed ??
      bridge.strategyDrawRequest?.configuration?.randomSeed ??
      bridge.audit?.randomSeed ??
      null,
    seedSummary: {
      required: policies.seed?.required === true,
      sourcePreference: policies.seed?.sourcePreference ?? null,
      seedCount: bridge.drawRequest?.seeds?.length || 0,
    },
    distributionSummary: {
      type: selection?.distributionType || policies.distribution?.type || "unknown",
      deterministic: policies.distribution?.deterministic,
    },
    constraintSummary: {
      enabled: policies.constraint?.enabled === true,
      categories: policies.constraint?.categories || [],
      repairAllowed: policies.constraint?.repairAllowed === true,
    },
    balanceSummary: {
      enabled: policies.balance?.enabled === true,
      metric: policies.balance?.metric ?? null,
      targetSpread: policies.balance?.targetSpread ?? null,
      legacyBalance: bridge.legacyResult?.balance ?? null,
    },
    finalPlacements,
    warnings: [
      ...(bridge.legacyResult?.warnings || []),
      ...(bridge.drawResult?.warnings || []),
      ...(input.parity?.warnings || []),
    ],
    parityStatus,
    metadata: {
      usedCanonical: bridge.usedCanonical === true,
      executionPath: bridge.executionPath,
      traceRecords: summary.total,
    },
  };
}

/**
 * @param {CompleteDrawTraceRecord} record
 * @returns {boolean}
 */
export function isDrawTraceJsonSerializable(record) {
  try {
    JSON.stringify(record);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {CompleteDrawTraceRecord} record
 * @returns {string[]}
 */
export function validateCompleteDrawTraceRecord(record = {}) {
  const errors = [];
  const required = [
    "traceId",
    "engineVersion",
    "strategy",
    "legacyRuntime",
    "seedSummary",
    "distributionSummary",
    "constraintSummary",
    "balanceSummary",
    "finalPlacements",
    "warnings",
    "parityStatus",
  ];
  for (const key of required) {
    if (record[key] === undefined) {
      errors.push(`Missing trace field: ${key}`);
    }
  }
  if (!isDrawTraceJsonSerializable(record)) {
    errors.push("Trace record is not JSON serializable.");
  }
  return errors;
}

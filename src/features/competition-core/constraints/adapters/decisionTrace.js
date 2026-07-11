import { RULE_ENGINE_VERSION } from "../ruleConstants.js";

/**
 * @typedef {Object} DecisionTraceRecord
 * @property {string} id
 * @property {string} consumer
 * @property {string} action
 * @property {boolean} usedCanonical
 * @property {boolean} feasible
 * @property {boolean} eligible
 * @property {number} softScore
 * @property {string} engineVersion
 * @property {string} [ruleSetId]
 * @property {string} [ruleSetVersion]
 * @property {import('../../types/index.js').ConstraintExplanation[]} explanations
 * @property {string} evaluatedAt
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} DecisionTrace
 * @property {DecisionTraceRecord[]} records
 * @property {string} traceVersion
 */

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `trace-${Date.now()}-${traceCounter}`;
}

/**
 * @param {Partial<DecisionTraceRecord>} partial
 * @returns {DecisionTraceRecord}
 */
export function createDecisionTraceRecord(partial) {
  return {
    id: partial.id || nextTraceId(),
    consumer: String(partial.consumer || "unknown"),
    action: String(partial.action || "evaluate"),
    usedCanonical: partial.usedCanonical === true,
    feasible: partial.feasible !== false,
    eligible: partial.eligible !== false,
    softScore: Number(partial.softScore ?? 0),
    engineVersion: partial.engineVersion || RULE_ENGINE_VERSION,
    ruleSetId: partial.ruleSetId,
    ruleSetVersion: partial.ruleSetVersion,
    explanations: Array.isArray(partial.explanations) ? [...partial.explanations] : [],
    evaluatedAt: partial.evaluatedAt || new Date().toISOString(),
    metadata: partial.metadata ? { ...partial.metadata } : undefined,
  };
}

/**
 * @returns {DecisionTrace}
 */
export function createDecisionTrace() {
  return {
    records: [],
    traceVersion: "cc03b-v1",
  };
}

/**
 * @param {DecisionTrace} trace
 * @param {DecisionTraceRecord} record
 * @returns {DecisionTrace}
 */
export function appendDecisionTrace(trace, record) {
  if (!trace) {
    return { records: [record], traceVersion: "cc03b-v1" };
  }
  return {
    ...trace,
    records: [...(trace.records || []), record],
  };
}

/**
 * @param {DecisionTrace} trace
 * @returns {{ total: number, rejectCount: number, scoreCount: number, last: DecisionTraceRecord|null }}
 */
export function summarizeDecisionTrace(trace) {
  const records = trace?.records || [];
  return {
    total: records.length,
    rejectCount: records.filter((item) => !item.feasible).length,
    scoreCount: records.filter((item) => item.feasible && item.softScore !== 0).length,
    last: records.length ? records[records.length - 1] : null,
  };
}

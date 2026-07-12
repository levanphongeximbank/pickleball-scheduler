import { FORMATION_RUNTIME_ADAPTER_VERSION } from "./formationRuntimeInventory.js";
import { summarizeFormationRuntimeDecisionTrace } from "./formationDecisionTrace.js";
import { containsSecretLikeKeys } from "./formationPayloadPreservation.js";

/**
 * @typedef {Object} CompleteFormationTraceRecord
 * @property {string} traceId
 * @property {string} engineVersion
 * @property {string} strategy
 * @property {string|null} requestId
 * @property {string|null} sessionId
 * @property {number} playersConsidered
 * @property {string[]} constraintsEvaluated
 * @property {string[]} hardRejects
 * @property {Record<string, unknown>} softContributions
 * @property {Array<{ pairKey: string, playerIds: string[] }>} selectedPairs
 * @property {Record<string, unknown>} courtAllocation
 * @property {string[]} waitingPlayers
 * @property {Record<string, unknown>} randomSourceMetadata
 * @property {string[]} warnings
 * @property {string} parityStatus
 */

let formationTraceCounter = 0;

function nextFormationTraceId() {
  formationTraceCounter += 1;
  return `formation-trace-${Date.now()}-${formationTraceCounter}`;
}

/**
 * Redact secret-like keys from trace for safe serialization.
 *
 * @param {Record<string, unknown>} record
 */
export function redactFormationTraceSecrets(record = {}) {
  const redacted = JSON.parse(JSON.stringify(record, (_, value) => {
    if (typeof value === "function") {
      return "[Function]";
    }
    if (value instanceof Map) {
      return { __type: "Map", size: value.size };
    }
    if (value instanceof Set) {
      return { __type: "Set", size: value.size };
    }
    return value;
  }));

  function scrub(obj) {
    if (!obj || typeof obj !== "object") {
      return;
    }
    for (const key of Object.keys(obj)) {
      if (/token|password|secret|service.?role|refresh/i.test(key)) {
        obj[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object") {
        scrub(obj[key]);
      }
    }
  }
  scrub(redacted);
  return redacted;
}

/**
 * Build JSON-serializable complete formation trace for CC-05C verification.
 *
 * @param {Object} input
 * @param {import('./formationRuntimeAdapter.js').CanonicalFormationBridgeResult} [input.bridge]
 * @param {import('./formationParityModel.js').FormationParityComparison} [input.parity]
 * @param {string} [input.consumer]
 */
export function buildCompleteFormationTraceRecord(input = {}) {
  const bridge = input.bridge || {};
  const request = bridge.formationRequest || {};
  const result = bridge.formationResult || {};
  const traceRecord = bridge.trace?.records?.[bridge.trace.records.length - 1];
  const summary = summarizeFormationRuntimeDecisionTrace(bridge.trace);

  const selectedPairs = (result.pairs || bridge.legacyResult?.teams || []).map((item) => {
    const playerIds = item.playerIds || item.members?.map((p) => p.id) || [];
    return {
      pairKey: [...playerIds].map(String).sort().join("|"),
      playerIds: [...playerIds].map(String),
    };
  });

  const parityStatus = input.parity
    ? input.parity.ok
      ? "parity_pass"
      : "parity_fail"
    : bridge.outputPreserved
      ? "output_preserved"
      : "unknown";

  const record = {
    traceId: traceRecord?.id || nextFormationTraceId(),
    engineVersion: FORMATION_RUNTIME_ADAPTER_VERSION,
    strategy: request.policy?.strategy || bridge.audit?.strategy || "unknown",
    requestId: request.eventId ?? request.sessionId ?? null,
    sessionId: request.sessionId ?? null,
    playersConsidered: request.players?.length || 0,
    constraintsEvaluated: (request.constraints || [])
      .filter((c) => c.enabled !== false)
      .map((c) => c.kind),
    hardRejects: [],
    softContributions: {
      scoreBreakdown: result.audit?.scores ?? null,
    },
    selectedPairs,
    courtAllocation: result.audit?.courtAllocation ?? {},
    waitingPlayers: (bridge.legacyResult?.waitingPlayerIds || []).map(String),
    randomSourceMetadata: {
      seed: request.randomSeed ?? null,
      randomFnPreserved: bridge.randomFnPreserved === true,
      hasRandomFn: typeof request.options?.randomFn === "function",
    },
    warnings: [
      ...(bridge.legacyResult?.warnings || []),
      ...(result.warnings || []),
      ...(input.parity?.mismatches || []),
    ],
    parityStatus,
    metadata: {
      usedCanonical: bridge.usedCanonical === true,
      executionPath: bridge.executionPath,
      consumer: input.consumer || traceRecord?.consumer || "unknown",
      traceRecords: summary.total,
    },
  };

  return redactFormationTraceSecrets(record);
}

/**
 * @param {CompleteFormationTraceRecord} record
 * @returns {boolean}
 */
export function isFormationTraceJsonSerializable(record) {
  try {
    JSON.stringify(record);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {CompleteFormationTraceRecord} record
 * @returns {string[]}
 */
export function validateCompleteFormationTraceRecord(record = {}) {
  const errors = [];
  const required = [
    "traceId",
    "engineVersion",
    "strategy",
    "playersConsidered",
    "constraintsEvaluated",
    "selectedPairs",
    "courtAllocation",
    "waitingPlayers",
    "randomSourceMetadata",
    "warnings",
    "parityStatus",
  ];
  for (const key of required) {
    if (record[key] === undefined) {
      errors.push(`Missing trace field: ${key}`);
    }
  }
  if (!isFormationTraceJsonSerializable(record)) {
    errors.push("Trace record is not JSON serializable.");
  }
  if (containsSecretLikeKeys(record)) {
    errors.push("Trace record contains secret-like keys.");
  }
  return errors;
}

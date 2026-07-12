import { MATCHMAKING_RUNTIME_ADAPTER_VERSION } from "./matchmakingRuntimeInventory.js";
import { summarizeMatchmakingRuntimeDecisionTrace } from "./matchmakingDecisionTrace.js";

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `matchmaking-trace-${Date.now()}-${traceCounter}`;
}

export function redactMatchmakingTraceSecrets(record = {}) {
  const redacted = JSON.parse(
    JSON.stringify(record, (_, value) => {
      if (typeof value === "function") {
        return "[Function]";
      }
      return value;
    })
  );

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

export function buildCompleteMatchmakingTraceRecord(input = {}) {
  const bridge = input.bridge || {};
  const request = bridge.matchmakingRequest || {};
  const result = bridge.matchmakingResult || {};
  const traceRecord = bridge.trace?.records?.[bridge.trace.records.length - 1];
  const summary = summarizeMatchmakingRuntimeDecisionTrace(bridge.trace);

  const parityStatus = input.parity
    ? input.parity.ok
      ? "parity_pass"
      : "parity_fail"
    : bridge.outputPreserved
      ? "output_preserved"
      : "unknown";

  return redactMatchmakingTraceSecrets({
    traceId: traceRecord?.id || nextTraceId(),
    engineVersion: MATCHMAKING_RUNTIME_ADAPTER_VERSION,
    strategy: request.policy?.strategy || bridge.audit?.strategy || "unknown",
    requestId: request.sessionId ?? request.tournamentId ?? null,
    sessionId: request.sessionId ?? null,
    playersConsidered: request.players?.length || 0,
    courtCount: result.courts?.length || bridge.legacyResult?.courts?.length || 0,
    waitingPlayers: (bridge.legacyResult?.waiting || []).map((p) => String(p.id ?? p)),
    scores: result.scores ?? null,
    randomSourceMetadata: {
      seed: request.randomSeed ?? null,
      randomFnPreserved: bridge.randomFnPreserved === true,
    },
    warnings: [
      ...(bridge.legacyResult?.errors || []),
      ...(input.parity?.mismatches || []),
    ],
    parityStatus,
    metadata: {
      usedCanonical: bridge.usedCanonical === true,
      executionPath: bridge.executionPath,
      consumer: input.consumer || traceRecord?.consumer || "unknown",
      traceRecords: summary.total,
    },
  });
}

export function isMatchmakingTraceJsonSerializable(record) {
  try {
    JSON.stringify(record);
    return true;
  } catch {
    return false;
  }
}

export function validateCompleteMatchmakingTraceRecord(record = {}) {
  const errors = [];
  const required = [
    "traceId",
    "engineVersion",
    "strategy",
    "playersConsidered",
    "courtCount",
    "waitingPlayers",
    "parityStatus",
  ];
  for (const key of required) {
    if (record[key] === undefined) {
      errors.push(`Missing trace field: ${key}`);
    }
  }
  if (!isMatchmakingTraceJsonSerializable(record)) {
    errors.push("Trace record is not JSON serializable.");
  }
  return errors;
}

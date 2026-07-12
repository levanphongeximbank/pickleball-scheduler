import { isMatchmakingV2Enabled } from "../../config/featureFlags.js";
import { createMatchmakingAudit } from "../matchmakingContracts.js";
import {
  appendMatchmakingRuntimeDecisionTrace,
  buildMatchmakingDecisionPath,
  createMatchmakingRuntimeDecisionTrace,
  createMatchmakingRuntimeDecisionTraceRecord,
} from "./matchmakingDecisionTrace.js";
import { MATCHMAKING_RUNTIME_ADAPTER_VERSION } from "./matchmakingRuntimeInventory.js";
import {
  buildLegacyRunAIOptions,
  cloneLegacyMatchmakingPayload,
  mapLegacyMatchmakingPayloadToCanonicalRequest,
  mapLegacyMatchmakingPayloadToPolicy,
  resolveLegacyMatchmakingRandomFn,
} from "./legacyMatchmakingPayloadMappers.js";
import {
  adaptMatchmakingResultForLegacyConsumer,
  isLegacyMatchmakingOutputPreserved,
  mapLegacyMatchmakingResultToMatchmakingResult,
} from "./legacyMatchmakingResultMappers.js";

/**
 * @typedef {Object} CanonicalMatchmakingBridgeResult
 * @property {boolean} usedCanonical
 * @property {'legacy'|'canonical-adapter'} executionPath
 * @property {import('./legacyMatchmakingResultMappers.js').LegacyRunAIResult} legacyResult
 * @property {import('../matchmakingTypes.js').MatchmakingRequest} [matchmakingRequest]
 * @property {import('../matchmakingTypes.js').MatchmakingResult} [matchmakingResult]
 * @property {import('./matchmakingDecisionTrace.js').MatchmakingRuntimeDecisionTrace} trace
 * @property {import('../matchmakingTypes.js').MatchmakingAudit} [audit]
 * @property {boolean} outputPreserved
 * @property {boolean} randomFnPreserved
 */

export function resolveMatchmakingEnvSource(explicit) {
  if (explicit !== undefined) {
    return explicit;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

/**
 * CC-06 canonical matchmaking runtime adapter.
 * Flag OFF → direct legacy. Flag ON → canonical envelope → same legacy executor.
 *
 * @param {Object} input
 * @param {string} input.consumer
 * @param {import('./legacyMatchmakingPayloadMappers.js').LegacyMatchmakingPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {(players: Array<Record<string, unknown>>, options: Record<string, unknown>) => import('./legacyMatchmakingResultMappers.js').LegacyRunAIResult} input.legacyExecutor
 */
export function evaluateCanonicalMatchmaking(input) {
  const trace = input.trace || createMatchmakingRuntimeDecisionTrace();
  const envSource = resolveMatchmakingEnvSource(input.envSource);
  const payloadSnapshot = cloneLegacyMatchmakingPayload(input.legacyPayload || {});
  const incomingRandomFn = resolveLegacyMatchmakingRandomFn(payloadSnapshot);

  if (typeof input.legacyExecutor !== "function") {
    const record = createMatchmakingRuntimeDecisionTraceRecord({
      consumer: String(input.consumer || "unknown"),
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "error", label: "Legacy executor not configured" }],
      metadata: { error: "missing_legacy_executor" },
    });

    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult: { courts: [], waiting: [], errors: ["Legacy executor not configured"] },
      trace: appendMatchmakingRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      randomFnPreserved: true,
    };
  }

  if (!isMatchmakingV2Enabled(envSource)) {
    const players = payloadSnapshot.players || [];
    const legacyResult = input.legacyExecutor(players, buildLegacyRunAIOptions(payloadSnapshot));
    const record = createMatchmakingRuntimeDecisionTraceRecord({
      consumer: String(input.consumer || "unknown"),
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "legacy", label: "MATCHMAKING_V2 flag off — direct legacy runtime" }],
      metadata: { flag: "off" },
    });

    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult,
      trace: appendMatchmakingRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      randomFnPreserved: true,
    };
  }

  const matchmakingRequest = mapLegacyMatchmakingPayloadToCanonicalRequest(payloadSnapshot);
  const policy = mapLegacyMatchmakingPayloadToPolicy(payloadSnapshot);
  matchmakingRequest.policy = policy;

  const players = payloadSnapshot.players || [];
  const legacyResult = input.legacyExecutor(players, buildLegacyRunAIOptions(payloadSnapshot));
  const matchmakingResult = mapLegacyMatchmakingResultToMatchmakingResult(
    legacyResult,
    matchmakingRequest
  );
  const adaptedLegacyResult = adaptMatchmakingResultForLegacyConsumer(
    matchmakingResult,
    legacyResult
  );
  const outputPreserved = isLegacyMatchmakingOutputPreserved(legacyResult, adaptedLegacyResult);
  const randomFnPreserved =
    incomingRandomFn === resolveLegacyMatchmakingRandomFn(payloadSnapshot);

  const decisionPath = buildMatchmakingDecisionPath({ matchmakingRequest, matchmakingResult });

  const audit = createMatchmakingAudit({
    engineVersion: MATCHMAKING_RUNTIME_ADAPTER_VERSION,
    strategy: policy.strategy,
    seed: matchmakingRequest.randomSeed ?? payloadSnapshot.randomSeed ?? null,
    scores: matchmakingResult.scores,
    courtAllocation: matchmakingResult.audit?.courtAllocation ?? {},
    warnings: matchmakingResult.warnings || [],
  });

  const record = createMatchmakingRuntimeDecisionTraceRecord({
    consumer: String(input.consumer || "unknown"),
    usedCanonical: true,
    executionPath: "canonical-adapter",
    path: decisionPath,
    metadata: {
      strategyId: policy.strategy,
      courtCount: legacyResult.courts?.length || 0,
      waitingCount: legacyResult.waiting?.length || 0,
      randomFnPreserved,
    },
  });

  return {
    usedCanonical: true,
    executionPath: "canonical-adapter",
    legacyResult: outputPreserved ? legacyResult : adaptedLegacyResult,
    matchmakingRequest,
    matchmakingResult,
    trace: appendMatchmakingRuntimeDecisionTrace(trace, record),
    audit,
    outputPreserved,
    randomFnPreserved,
  };
}

/**
 * @param {Object} input
 * @param {string} input.consumer
 * @param {import('./legacyMatchmakingPayloadMappers.js').LegacyMatchmakingPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {Function} input.legacyExecutor
 */
export function runLegacyMatchmakingWithCanonicalAdapter(input) {
  const bridge = evaluateCanonicalMatchmaking({
    consumer: input.consumer,
    legacyPayload: {
      ...input.legacyPayload,
      strategyKey: input.strategyKey || input.legacyPayload?.strategyKey,
      legacyStrategyKey: input.strategyKey || input.legacyPayload?.legacyStrategyKey,
    },
    envSource: input.envSource,
    legacyExecutor: input.legacyExecutor,
  });
  return bridge.legacyResult;
}
